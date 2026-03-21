import { AlgorandClient, algo } from "@algorandfoundation/algokit-utils";
import type { EscrowState } from "@/lib/agents/types";

let algorandClient: AlgorandClient | null = null;

export function getClient(): AlgorandClient {
  if (!algorandClient) {
    algorandClient = AlgorandClient.defaultLocalNet();
  }
  return algorandClient;
}

interface AccountInfo {
  address: string;
  balance: number;
}

interface TransactionResult {
  txId: string;
  confirmedRound: number;
}

let storedAccounts: {
  buyerAddr: string;
  sellerAddrs: Record<string, string>;
} | null = null;

let escrowState: EscrowState = {
  status: "idle",
  buyerAddress: "",
  sellerAddress: "",
  amount: 0,
  txId: "",
  confirmedRound: 0,
};

export async function getBalance(address: string): Promise<number> {
  const algorand = getClient();
  const info = await algorand.account.getInformation(address);
  return info.balance.algos;
}

export async function initAccounts(): Promise<{
  buyer: AccountInfo;
  sellers: Record<string, AccountInfo>;
}> {
  const algorand = getClient();
  const dispenser = await algorand.account.localNetDispenser();

  const buyerAccount = algorand.account.random();
  algorand.setSignerFromAccount(buyerAccount);
  await algorand.send.payment({
    sender: dispenser.addr,
    receiver: buyerAccount.addr,
    amount: algo(5000),
  });

  const sellerNames = ["cloudmax", "datavault", "quickapi", "bharatcompute", "securehost"];
  const sellerAccounts: Record<string, AccountInfo> = {};
  const sellerAddrs: Record<string, string> = {};

  for (const name of sellerNames) {
    const sellerAccount = algorand.account.random();
    algorand.setSignerFromAccount(sellerAccount);
    await algorand.send.payment({
      sender: dispenser.addr,
      receiver: sellerAccount.addr,
      amount: algo(100),
    });
    const bal = await getBalance(sellerAccount.addr.toString());
    sellerAccounts[name] = { address: sellerAccount.addr.toString(), balance: bal };
    sellerAddrs[name] = sellerAccount.addr.toString();
  }

  const buyerBal = await getBalance(buyerAccount.addr.toString());
  storedAccounts = { buyerAddr: buyerAccount.addr.toString(), sellerAddrs };

  return {
    buyer: { address: buyerAccount.addr.toString(), balance: buyerBal },
    sellers: sellerAccounts,
  };
}

export function getStoredAccounts() {
  return storedAccounts;
}

export async function executePayment(
  sellerAddress: string,
  amountAlgo: number
): Promise<EscrowState> {
  const algorand = getClient();
  if (!storedAccounts) throw new Error("Accounts not initialized");

  const { buyerAddr } = storedAccounts;
  const buyerBal = await getBalance(buyerAddr);
  if (buyerBal < amountAlgo + 0.1) {
    throw new Error(`Insufficient balance: ${buyerBal.toFixed(2)} ALGO < ${amountAlgo + 0.1} ALGO needed`);
  }

  const result = await algorand.send.payment({
    sender: buyerAddr,
    receiver: sellerAddress,
    amount: algo(amountAlgo),
    note: `A2A Commerce Payment | ${amountAlgo} ALGO`,
  });

  const txId = result.txIds[0];
  const confirmedRound = Number(result.confirmation.confirmedRound ?? 0n);

  escrowState = {
    status: "released",
    buyerAddress: buyerAddr,
    sellerAddress,
    amount: amountAlgo,
    txId,
    confirmedRound,
  };

  return { ...escrowState };
}

export function getEscrowState(): EscrowState {
  return { ...escrowState };
}

export function resetState(): void {
  escrowState = { status: "idle", buyerAddress: "", sellerAddress: "", amount: 0, txId: "", confirmedRound: 0 };
  storedAccounts = null;
  algorandClient = null;
}
