import { getClient, getStoredAccounts } from "./algorand";
import { algo } from "@algorandfoundation/algokit-utils";
import type { OnChainListing } from "@/lib/agents/types";

const LISTING_PREFIX = "a2a-listing:";

interface ListingData {
  type: string;
  service: string;
  price: number;
  seller: string;
  description: string;
  timestamp: number;
  zkProof?: string;
}

const SEED_LISTINGS: ListingData[] = [
  {
    type: "cloud-storage",
    service: "CloudMax India Enterprise Storage",
    price: 90,
    seller: "cloudmax",
    description: "Enterprise-grade cloud storage with Mumbai & Chennai data centers. 99.99% uptime, end-to-end encryption, SOC2 compliant.",
    timestamp: Date.now(),
  },
  {
    type: "cloud-storage",
    service: "DataVault SME Storage",
    price: 85,
    seller: "datavault",
    description: "Affordable cloud storage for Indian SMEs. Auto-scaling, pay-as-you-go with Hyderabad servers.",
    timestamp: Date.now(),
  },
  {
    type: "api-access",
    service: "QuickAPI Gateway Pro",
    price: 50,
    seller: "quickapi",
    description: "High-performance API gateway with rate limiting, caching, analytics. Built for fintech & e-commerce.",
    timestamp: Date.now(),
  },
  {
    type: "compute",
    service: "BharatCompute GPU Instances",
    price: 120,
    seller: "bharatcompute",
    description: "NVIDIA A100 GPU clusters in Pune for ML workloads. Per-minute billing, spot pricing available.",
    timestamp: Date.now(),
  },
  {
    type: "hosting",
    service: "SecureHost Pro Managed Hosting",
    price: 70,
    seller: "securehost",
    description: "Managed hosting with DDoS protection, auto-SSL, and CDN. Ideal for Indian startups.",
    timestamp: Date.now(),
  },
];

export async function postListingsOnChain(): Promise<string[]> {
  const algorand = getClient();
  const accounts = getStoredAccounts();
  if (!accounts) throw new Error("Accounts not initialized");

  const txIds: string[] = [];

  for (const listing of SEED_LISTINGS) {
    const sellerAddr = accounts.sellerAddrs[listing.seller];
    if (!sellerAddr) continue;

    const zkProof = generateSimpleZKProof(listing.seller, listing.price);
    const noteData: ListingData = { ...listing, zkProof, timestamp: Date.now() };
    const noteStr = LISTING_PREFIX + JSON.stringify(noteData);

    const result = await algorand.send.payment({
      sender: sellerAddr,
      receiver: sellerAddr,
      amount: algo(0),
      note: noteStr,
    });

    txIds.push(result.txIds[0]);
  }

  return txIds;
}

export async function fetchListingsFromChain(): Promise<OnChainListing[]> {
  const algorand = getClient();
  const accounts = getStoredAccounts();
  if (!accounts) throw new Error("Accounts not initialized");

  const listings: OnChainListing[] = [];
  const allAddresses = Object.values(accounts.sellerAddrs);

  for (const addr of allAddresses) {
    try {
      const searchResult = await algorand.client.indexer
        .searchForTransactions()
        .address(addr)
        .notePrefix(Buffer.from(LISTING_PREFIX).toString("base64"))
        .do();

      const txns = searchResult.transactions ?? [];
      for (const txn of txns) {
        try {
          const noteRaw = txn.note;
          if (!noteRaw) continue;

          const noteStr = typeof noteRaw === "string"
            ? Buffer.from(noteRaw, "base64").toString("utf-8")
            : new TextDecoder().decode(noteRaw as Uint8Array);
          if (!noteStr.startsWith(LISTING_PREFIX)) continue;

          const data: ListingData = JSON.parse(noteStr.slice(LISTING_PREFIX.length));

          listings.push({
            txId: txn.id ?? "",
            sender: txn.sender ?? "",
            type: data.type,
            service: data.service,
            price: data.price,
            seller: data.seller,
            description: data.description,
            timestamp: data.timestamp,
            zkProof: data.zkProof,
            round: Number(txn.confirmedRound ?? 0),
          });
        } catch {
          // skip malformed notes
        }
      }
    } catch {
      // indexer may not have this address yet
    }
  }

  return listings;
}

export function filterListings(
  listings: OnChainListing[],
  serviceType: string,
  maxBudget: number
): OnChainListing[] {
  const normalized = serviceType.toLowerCase().replace(/[\s_-]+/g, "-");
  return listings.filter((l) => {
    const typeMatch =
      l.type === normalized ||
      l.service.toLowerCase().includes(normalized.replace(/-/g, " ")) ||
      l.type.includes(normalized.split("-")[0]);
    return typeMatch && l.price <= maxBudget;
  });
}

function generateSimpleZKProof(seller: string, price: number): string {
  const claim = `${seller}:${price}:${Date.now()}`;
  let hash = 0;
  for (let i = 0; i < claim.length; i++) {
    const chr = claim.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}
