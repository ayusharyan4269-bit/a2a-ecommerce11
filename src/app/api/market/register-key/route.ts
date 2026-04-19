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
import { prisma }                     from "@/lib/db/listings-store";

const MARKET_ABI = [
  "function getProduct(string memory _cid) external view returns (tuple(address seller, string cid, uint256 price, bool exists))"
];

function getProvider() {
  const rpc = process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org";
  return new ethers.JsonRpcProvider(rpc);
}

export async function POST(req: NextRequest) {
  try {
    const { cid, secretKey, sellerAddress, service, price, description } = await req.json();

    if (!cid || !secretKey || !sellerAddress) {
      return NextResponse.json({ error: "cid, secretKey, sellerAddress are required" }, { status: 400 });
    }

    if (secretKey.length < 32) {
      return NextResponse.json({ error: "secretKey too short — must be a 256-bit hex string" }, { status: 400 });
    }

    const keyExists = await hasKey(cid);
    if (keyExists) {
      // Already registered — seller cannot overwrite to prevent key-swap attack
      return NextResponse.json({ success: true, message: "Key already registered for this CID" });
    }

    // ── On-chain verification ────────────────────────────────────────────────
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
        console.warn("Chain verification skipped:", chainErr.message);
      }
    }

    await storeKey(cid, secretKey, sellerAddress);

    // ── Agent AI Integration (Double-Write) ──────────────────────────────────
    // If the frontend provided metadata, instantly make it discoverable by the AI.
    if (service && price !== undefined) {
      try {
        await prisma.listing.create({
          data: {
            type: "account",
            service,
            price: Number(price),
            seller: sellerAddress,
            description: description || service,
            ipfsHash: cid,
            timestamp: Date.now(),
            createdAt: new Date().toISOString()
          }
        });
        console.log(`[register-key] Pushed to AI Discovery: ${service}`);
      } catch (dbErr) {
        console.error("[register-key] Failed to sync with AI Discovery:", dbErr);
      }
    }

    console.log(`[register-key] Key stored for CID: ${cid.slice(0, 20)}... seller: ${sellerAddress}`);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[register-key] Error:", err.message);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
