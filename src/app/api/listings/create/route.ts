import { NextRequest, NextResponse } from "next/server";
import { createListing } from "@/lib/db/listings-store";
import { encryptString } from "@/lib/encryption";
import { createHash, randomBytes } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { service, type, price, description, seller, username, password, notes, signature, ipfsHash } = body;

    if (!service || !type || !price || !seller) {
      return NextResponse.json(
        { error: "service, type, price, and seller (wallet address) are required" },
        { status: 400 }
      );
    }

    // Generate a proper ZK-style Fair Exchange commitment hash
    let zkCommitment = "";
    if (password) {
      zkCommitment = createHash("sha256").update(password).digest("hex");
    } else {
      const secret = randomBytes(16).toString("hex");
      zkCommitment = createHash("sha256").update(`${secret}|${seller}|${price}|${service}`).digest("hex");
    }

    const listing = await createListing({
      service,
      type: type ?? "cloud-storage",
      price: parseFloat(price),
      description: description ?? "",
      seller,
      username,
      password: password ? encryptString(password) : undefined,
      notes: notes ?? "",
      signature,
      zkCommitment,
      ipfsHash: ipfsHash ?? null,   // Store the IPFS CID — seller wallet + item permanently linked
      timestamp: Date.now(),
    });

    return NextResponse.json({
      success: true,
      listing: {
        id: listing.id,
        service: listing.service,
        type: listing.type,
        price: listing.price,
        seller: listing.seller,
        zkCommitment: listing.zkCommitment,
        createdAt: listing.createdAt,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to create listing";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
