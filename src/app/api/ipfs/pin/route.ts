import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const data = await req.json();

    const PINATA_JWT = process.env.PINATA_JWT;
    if (!PINATA_JWT || PINATA_JWT === "your_pinata_jwt_here") {
      return NextResponse.json(
        { error: "PINATA_JWT environment variable is missing or invalid. Check .env.local" },
        { status: 500 }
      );
    }

    // Pinata expects a specific payload format for JSON
    const pinataPayload = {
      pinataOptions: {
        cidVersion: 1
      },
      pinataMetadata: {
        name: `A2A_Listing_${Date.now()}`
      },
      pinataContent: data
    };

    const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PINATA_JWT}`
      },
      body: JSON.stringify(pinataPayload)
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: "Pinata API Error: " + errText }, { status: response.status });
    }

    const result = await response.json();
    
    // Return the IPFS CID to the frontend
    return NextResponse.json({ 
      success: true, 
      IpfsHash: result.IpfsHash,
      PinSize: result.PinSize,
      Timestamp: result.Timestamp
    });

  } catch (error: any) {
    console.error("IPFS Pinning Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
