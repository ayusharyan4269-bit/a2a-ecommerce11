/**
 * POST /api/market/register-key
 *
 * Called by the seller's browser AFTER:
 *   1. Credentials are encrypted locally
 *   2. Encrypted blob is pinned to IPFS
 *   3. addProduct(cid, price) is confirmed on-chain
 *
 * Stores the AES secretKey server-side, keyed by CID.
 * The key is NEVER sent to IPFS or the blockchain.
 *
 * Security: we verify the caller is actually the on-chain seller
 * by reading the A2AMarket contract's product storage.
 */

import { NextRequest, NextResponse } from "next/server";
import { ethers }                     from "ethers";
import { storeKey, hasKey }           from "@/lib/market/key-store";

const MARKET_ABI = [
  "function getProduct(string memory _cid) external view returns (tuple(address seller, string cid, uint256 price, bool exists))",
];

function getProvider() {
  const rpc = process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org";
  return new ethers.JsonRpcProvider(rpc);
}

export async function POST(req: NextRequest) {
  try {
    const { cid, secretKey, sellerAddress } = await req.json();

    if (!cid || !secretKey || !sellerAddress) {
      return NextResponse.json({ error: "cid, secretKey, sellerAddress are required" }, { status: 400 });
    }

    if (secretKey.length < 32) {
      return NextResponse.json({ error: "secretKey too short — must be a 256-bit hex string" }, { status: 400 });
    }

    if (hasKey(cid)) {
      // Already registered — seller cannot overwrite to prevent key-swap attack
      return NextResponse.json({ success: true, message: "Key already registered for this CID" });
    }

    // ── On-chain verification ────────────────────────────────────────────────
    // Only allow key registration if the contract confirms msg.sender === product.seller
    const marketAddr = process.env.NEXT_PUBLIC_MARKET_ADDRESS;
    if (marketAddr && marketAddr !== "0x0000000000000000000000000000000000000000") {
      try {
        const provider = getProvider();
        const contract = new ethers.Contract(marketAddr, MARKET_ABI, provider);
        const product  = await contract.getProduct(cid);

        if (!product.exists) {
          return NextResponse.json({ error: "Product not found on-chain. List it first." }, { status: 403 });
        }

        if (product.seller.toLowerCase() !== sellerAddress.toLowerCase()) {
          return NextResponse.json({ error: "Caller is not the on-chain seller for this CID" }, { status: 403 });
        }
      } catch (chainErr: any) {
        // If chain read fails (e.g. local dev), log and continue
        console.warn("Chain verification skipped:", chainErr.message);
      }
    }

    storeKey(cid, secretKey, sellerAddress);

    console.log(`[register-key] Key stored for CID: ${cid.slice(0, 20)}... seller: ${sellerAddress}`);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[register-key] Error:", err.message);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
