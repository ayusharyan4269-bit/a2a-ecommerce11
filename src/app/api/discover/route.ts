/**
 * /api/discover — Find listings from local JSON DB matching the buyer's intent.
 */
import { NextRequest, NextResponse } from "next/server";
import { getAllListings } from "@/lib/db/listings-store";
import { createAction } from "@/lib/a2a/messaging";
import type { ParsedIntent } from "@/lib/agents/types";

export async function POST(req: NextRequest) {
  try {
    const { intent } = (await req.json()) as { intent: ParsedIntent };
    if (!intent?.serviceType) {
      return NextResponse.json({ error: "Intent is required" }, { status: 400 });
    }

    const actions = [
      createAction(
        "buyer",
        "Buyer Agent",
        "discovery",
        `Scanning A2A marketplace for listings matching **"${intent.serviceType}"**...`
      ),
    ];

    // Fetch all listings from local DB
    const allListings = await getAllListings();

    actions.push(
      createAction(
        "system",
        "TrustMesh DB",
        "discovery",
        `Found **${allListings.length} total listing(s)** in marketplace.`
      )
    );

    // Filter by service type and budget
    const serviceType = intent.serviceType.toLowerCase();
    const maxBudget = intent.maxBudget ?? 999;

    const filtered = allListings.filter((l) => {
      const typeMatch =
        l.type?.toLowerCase().includes(serviceType) ||
        l.service?.toLowerCase().includes(serviceType) ||
        l.description?.toLowerCase().includes(serviceType) ||
        serviceType.includes(l.type?.toLowerCase() ?? "");
      const budgetMatch = (l.price ?? 0) <= maxBudget;
      return typeMatch && budgetMatch;
    });

    if (filtered.length === 0) {
      // Fallback: return cheapest listings regardless of type
      const fallback = allListings.slice(0, 3);
      if (fallback.length > 0) {
        actions.push(
          createAction(
            "buyer",
            "Buyer Agent",
            "result",
            `No exact matches for **"${intent.serviceType}"**. Showing **${fallback.length}** available listings instead.`
          )
        );

        // Map to OnChainListing shape
        const mapped = fallback.map(toOnChainListing);
        return NextResponse.json({ listings: mapped, allCount: allListings.length, actions });
      }

      actions.push(
        createAction(
          "buyer",
          "Buyer Agent",
          "result",
          `No listings found. Go to **SELL** section to add services to the marketplace.`
        )
      );
      return NextResponse.json({ listings: [], allCount: 0, actions });
    }

    const listingSummary = filtered
      .map(
        (l) =>
          `• **${l.seller?.slice(0, 10) ?? "Agent"}...** — "${l.service}" at **${l.price} ETH** (ID: \`${(l.id ?? "").slice(0, 14)}...\`)${l.zkCommitment ? " [ZK ✓]" : ""}`
      )
      .join("\n");

    actions.push(
      createAction(
        "buyer",
        "Buyer Agent",
        "discovery",
        `**${filtered.length}** matching listing(s):\n\n${listingSummary}`,
        { listings: filtered }
      )
    );

    const mapped = filtered.map(toOnChainListing);
    return NextResponse.json({ listings: mapped, allCount: allListings.length, actions });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Discovery failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toOnChainListing(l: any) {
  return {
    txId: l.id ?? l.txId ?? "",
    id: l.id,
    sender: l.seller ?? "",
    type: l.type ?? "other",
    service: l.service ?? "",
    price: l.price ?? 0,
    seller: l.seller ?? "",
    description: l.description ?? "",
    timestamp: l.timestamp ?? 0,
    zkCommitment: l.zkCommitment ?? null,
    ipfsHash: l.ipfsHash ?? null,    // IPFS CID — the permanent link between seller wallet and item
    round: 0,
    sellerName: l.service ?? "Agent",
  };
}
