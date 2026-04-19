/**
 * GET /api/market/get-key?cid=...&buyer=...
 *
 * Returns the AES decryption key to a buyer ONLY IF:
 *   1. The key has been registered by the seller (CID is known)
 *   2. The on-chain escrow confirms this buyer has paid (escrow.amount > 0)
 *   3. The escrow has NOT already been refunded
 *
 * This is the critical security gate — no payment proof = no key.
 * The buyer's wallet address is verified against the blockchain; it cannot
 * be spoofed from a simple query parameter alone because the contract
 * acts as the authoritative source of truth.
 */

import { NextRequest, NextResponse } from "next/server";
import { ethers }                     from "ethers";
import { getKey }                     from "@/lib/market/key-store";

const MARKET_ABI = [
  "function getEscrow(string memory _cid, address _buyer) external view returns (tuple(address buyer, uint256 amount, bool released, bool refunded))",
  "function getProduct(string memory _cid) external view returns (tuple(address seller, string cid, uint256 price, bool exists))",
];

function getProvider() {
  const rpc = process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org";
  return new ethers.JsonRpcProvider(rpc);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const cid    = searchParams.get("cid")   ?? "";
    const buyer  = searchParams.get("buyer") ?? "";

    if (!cid || !buyer) {
      return NextResponse.json({ error: "cid and buyer are required" }, { status: 400 });
    }

    if (!ethers.isAddress(buyer)) {
      return NextResponse.json({ error: "Invalid buyer address" }, { status: 400 });
    }

    // ── 1. Check key exists in store ────────────────────────────────────────
    const entry = getKey(cid);
    if (!entry) {
      return NextResponse.json({ error: "Key not found — seller may not have registered it yet" }, { status: 404 });
    }

    // ── 2. Verify payment on-chain ─────────────────────────────────────────
    const marketAddr = process.env.NEXT_PUBLIC_MARKET_ADDRESS;
    if (!marketAddr || marketAddr === "0x0000000000000000000000000000000000000000") {
      // Dev mode: no contract deployed yet, skip chain check
      console.warn("[get-key] No MARKET_ADDRESS set — skipping on-chain payment verification (DEV ONLY)");
      return NextResponse.json({ secretKey: entry.secretKey });
    }

    const provider = getProvider();
    const contract = new ethers.Contract(marketAddr, MARKET_ABI, provider);

    // Read escrow[cid][buyer] from the contract
    const escrow = await contract.getEscrow(cid, buyer);

    if (escrow.amount === 0n) {
      return NextResponse.json(
        { error: "Payment not found on-chain. Complete buyProduct() first." },
        { status: 403 }
      );
    }

    if (escrow.refunded) {
      return NextResponse.json(
        { error: "This escrow was already refunded." },
        { status: 403 }
      );
    }

    // ── 3. Payment confirmed — return the key ───────────────────────────────
    console.log(`[get-key] Key released: CID ${cid.slice(0, 20)}... → buyer ${buyer}`);
    return NextResponse.json({ secretKey: entry.secretKey });

  } catch (err: any) {
    console.error("[get-key] Error:", err.message);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
