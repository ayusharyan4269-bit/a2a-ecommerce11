import algosdk from "algosdk";
import {
  getClient,
  getStoredAccounts,
  getSellerKeys,
  getIndexer,
} from "./algorand";
import { createZKCommitment } from "./zk";
import type { OnChainListing } from "@/lib/agents/types";

const INDEXER_TIMEOUT_MS = 22000;

async function withTimeout<T, F>(
  promise: Promise<T>,
  ms: number,
  fallback: F,
): Promise<T | F> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<F>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([promise.finally(() => clearTimeout(timer)), timeout]);
}

const LISTING_PREFIX = "a2a-listing:";

interface ListingData {
  type: string;
  service: string;
  price: number;
  seller: string;
  description: string;
  timestamp: number;
  zkCommitment?: string;
}

const SEED_LISTINGS: Omit<ListingData, "timestamp" | "zkCommitment">[] = [
  {
    type: "cloud-storage",
    service: "CloudMax India Enterprise Storage",
    price: 90,
    seller: "cloudmax",
    description:
      "Enterprise-grade cloud storage with Mumbai & Chennai data centers. 99.99% uptime, end-to-end encryption, SOC2 compliant.",
  },
  {
    type: "cloud-storage",
    service: "DataVault SME Storage",
    price: 85,
    seller: "datavault",
    description:
      "Affordable cloud storage for Indian SMEs. Auto-scaling, pay-as-you-go with Hyderabad servers.",
  },
  {
    type: "api-access",
    service: "QuickAPI Gateway Pro",
    price: 50,
    seller: "quickapi",
    description:
      "High-performance API gateway with rate limiting, caching, analytics. Built for fintech & e-commerce.",
  },
  {
    type: "compute",
    service: "BharatCompute GPU Instances",
    price: 120,
    seller: "bharatcompute",
    description:
      "NVIDIA A100 GPU clusters in Pune for ML workloads. Per-minute billing, spot pricing available.",
  },
  {
    type: "hosting",
    service: "SecureHost Pro Managed Hosting",
    price: 70,
    seller: "securehost",
    description:
      "Managed hosting with DDoS protection, auto-SSL, and CDN. Ideal for Indian startups.",
  },
];

const sellerSecrets = new Map<string, string>();

export function getSellerSecret(seller: string): string | undefined {
  return sellerSecrets.get(seller);
}

export async function postListingsOnChain(): Promise<string[]> {
  const algorand = getClient();
  const accounts = getStoredAccounts();
  const sellerKeyMap = getSellerKeys();
  if (!accounts) throw new Error("Accounts not initialized");

  const algod = algorand.client.algod;
  const txIds: string[] = [];

  for (const listing of SEED_LISTINGS) {
    const sellerAddr = accounts.sellerAddrs[listing.seller];
    const keyData = sellerKeyMap?.[listing.seller];
    if (!sellerAddr || !keyData) continue;

    const zk = createZKCommitment(
      listing.seller,
      listing.price,
      listing.description,
    );
    sellerSecrets.set(listing.seller, zk.secret);

    const noteData: ListingData = {
      ...listing,
      zkCommitment: zk.commitment,
      timestamp: Date.now(),
    };
    const noteBytes = new TextEncoder().encode(
      LISTING_PREFIX + JSON.stringify(noteData),
    );

    const params = await algod.getTransactionParams().do();
    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: algosdk.Address.fromString(sellerAddr),
      receiver: algosdk.Address.fromString(sellerAddr),
      amount: 0,
      note: noteBytes,
      suggestedParams: params,
    });

    const signedTxn = txn.signTxn(keyData.sk);
    const { txid } = await algod.sendRawTransaction(signedTxn).do();
    await algosdk.waitForConfirmation(algod, txid, 4);
    txIds.push(txid);
  }

  return txIds;
}

function parseTxnsToListings(txns: unknown[]): OnChainListing[] {
  const listings: OnChainListing[] = [];
  for (const rawTxn of txns) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const txn = rawTxn as any;
      const noteRaw = txn.note;
      if (!noteRaw) continue;

      let noteStr: string;
      if (typeof noteRaw === "string") {
        noteStr = Buffer.from(noteRaw, "base64").toString("utf-8");
      } else if (noteRaw instanceof Uint8Array) {
        noteStr = new TextDecoder().decode(noteRaw);
      } else {
        continue;
      }
      if (!noteStr.startsWith(LISTING_PREFIX)) continue;

      const data: ListingData = JSON.parse(
        noteStr.slice(LISTING_PREFIX.length),
      );
      listings.push({
        txId: String(txn.id ?? txn.txId ?? ""),
        sender: String(txn.sender ?? txn.from ?? ""),
        type: data.type,
        service: data.service,
        price: data.price,
        seller: data.seller,
        description: data.description,
        timestamp: data.timestamp,
        zkCommitment: data.zkCommitment,
        round: Number(txn["confirmed-round"] ?? txn.confirmedRound ?? 0),
      });
    } catch {
      // skip malformed
    }
  }
  return listings;
}

/** Get min-round for recent-only indexer searches (avoids SQL timeout on full history). */
async function getRecentMinRound(): Promise<number> {
  try {
    const algod = getClient().client.algod;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const status: any = await algod.status().do();
    const current = Number(status["last-round"] ?? status.lastRound ?? 0);
    return Math.max(0, current - 50_000); // ~2 days on TestNet
  } catch {
    return 0;
  }
}

/** Fetch listings without requiring initialized accounts — queries indexer by note prefix only. */
export async function fetchPublicListings(): Promise<OnChainListing[]> {
  const indexer = getIndexer();
  const notePrefixB64 = Buffer.from(LISTING_PREFIX).toString("base64");
  try {
    const minRound = await getRecentMinRound();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const searchResult: any = await withTimeout(
      indexer
        .searchForTransactions()
        .notePrefix(notePrefixB64)
        .minRound(minRound)
        .limit(100)
        .do(),
      INDEXER_TIMEOUT_MS,
      { transactions: [] },
    );
    return parseTxnsToListings(searchResult.transactions ?? []);
  } catch {
    return [];
  }
}

export async function fetchListingsFromChain(): Promise<OnChainListing[]> {
  const indexer = getIndexer();
  const accounts = getStoredAccounts();
  if (!accounts) return fetchPublicListings();

  const listings: OnChainListing[] = [];
  const allAddresses = Object.values(accounts.sellerAddrs);
  const minRound = await getRecentMinRound();
  const notePrefixB64 = Buffer.from(LISTING_PREFIX).toString("base64");

  for (const addr of allAddresses) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const searchResult: any = await withTimeout(
        indexer
          .searchForTransactions()
          .address(addr)
          .notePrefix(notePrefixB64)
          .minRound(minRound)
          .do(),
        INDEXER_TIMEOUT_MS,
        { transactions: [] },
      );
      listings.push(...parseTxnsToListings(searchResult.transactions ?? []));
    } catch {
      // indexer may not have this address yet
    }
  }

  return listings.length > 0 ? listings : fetchPublicListings();
}

export function filterListings(
  listings: OnChainListing[],
  serviceType: string,
  maxBudget: number,
  searchTerms?: string[],
): OnChainListing[] {
  const normalized = serviceType.toLowerCase().replace(/[\s_-]+/g, "-");
  const normalizedWords = normalized.replace(/-/g, " ");

  // Primary match: serviceType against type, service name, and description
  const primaryMatches = listings.filter((l) => {
    if (l.price > maxBudget) return false;
    const lType = l.type.toLowerCase();
    const lService = l.service.toLowerCase();
    const lDesc = l.description.toLowerCase();
    return (
      lType === normalized ||
      lService.includes(normalizedWords) ||
      lDesc.includes(normalizedWords) ||
      lType.includes(normalized.split("-")[0]) ||
      // Also check each word of the normalized serviceType individually
      normalized
        .split("-")
        .every(
          (word) =>
            word.length > 2 &&
            (lService.includes(word) ||
              lDesc.includes(word) ||
              lType.includes(word)),
        )
    );
  });

  if (primaryMatches.length > 0) return primaryMatches;

  // Fallback: use searchTerms for broader matching (catches "netflix", "spotify", etc.)
  const terms =
    searchTerms?.map((t) => t.toLowerCase()).filter((t) => t.length > 1) ?? [];
  if (terms.length === 0) return [];

  return listings.filter((l) => {
    if (l.price > maxBudget) return false;
    const lType = l.type.toLowerCase();
    const lService = l.service.toLowerCase();
    const lDesc = l.description.toLowerCase();
    const lSeller = l.seller.toLowerCase();
    // Match if ANY search term appears in type, service, description, or seller
    return terms.some(
      (term) =>
        lType.includes(term) ||
        lService.includes(term) ||
        lDesc.includes(term) ||
        lSeller.includes(term),
    );
  });
}
