import type { OnChainListing, X402Message } from "@/lib/agents/types";
import { createX402Message } from "@/lib/a2a/messaging";
import { generateNegotiationResponse } from "@/lib/ai/groq";
import { queryAgentReputation } from "@/lib/blockchain/algorand";

interface SellerStrategy {
  concession: number;   // fraction to concede per round
  minDiscount: number;  // max total discount willing to give
}

// Base strategies (before reputation adjustment)
const BASE_STRATEGIES: Record<string, SellerStrategy> = {
  cloudmax:       { concession: 0.08, minDiscount: 0.25 },
  datavault:      { concession: 0.12, minDiscount: 0.18 },
  quickapi:       { concession: 0.18, minDiscount: 0.30 },
  bharatcompute:  { concession: 0.10, minDiscount: 0.20 },
  securehost:     { concession: 0.15, minDiscount: 0.28 },
};

const DEFAULT_STRATEGY: SellerStrategy = { concession: 0.12, minDiscount: 0.20 };

/**
 * Adjust a seller's negotiation strategy based on their on-chain reputation.
 *
 * High reputation (>85): seller is confident, gives fewer concessions.
 * Medium reputation (70-85): normal strategy.
 * Low reputation (<70): seller needs deals, gives more concessions.
 * Zero/unregistered: moderate penalty (unknown entity, buyer should be wary).
 */
function adjustStrategyForReputation(base: SellerStrategy, reputation: number): SellerStrategy {
  if (reputation >= 90) {
    // Top tier — barely moves on price
    return {
      concession:  base.concession  * 0.60,
      minDiscount: base.minDiscount * 0.75,
    };
  }
  if (reputation >= 85) {
    // High confidence
    return {
      concession:  base.concession  * 0.80,
      minDiscount: base.minDiscount * 0.85,
    };
  }
  if (reputation >= 70) {
    // Normal — no adjustment
    return { ...base };
  }
  if (reputation >= 50) {
    // Below average — more willing to deal
    return {
      concession:  base.concession  * 1.30,
      minDiscount: base.minDiscount * 1.20,
    };
  }
  if (reputation > 0) {
    // Poor reputation — heavily discounts to attract buyers
    return {
      concession:  base.concession  * 1.60,
      minDiscount: base.minDiscount * 1.40,
    };
  }
  // Unregistered (reputation === 0) — slightly disadvantaged
  return {
    concession:  base.concession  * 1.15,
    minDiscount: base.minDiscount * 1.10,
  };
}

export async function sellerRespond(
  listing: OnChainListing,
  buyerOffer: number,
  round: number,
  buyerAgentId: string
): Promise<{ message: X402Message; counterPrice: number; accepted: boolean; reputationScore: number }> {
  // Query on-chain reputation for this seller
  const repData = await queryAgentReputation(listing.sender);
  const reputationScore = repData?.reputation ?? 0;

  const baseStrategy = BASE_STRATEGIES[listing.seller] ?? DEFAULT_STRATEGY;
  const strategy = adjustStrategyForReputation(baseStrategy, reputationScore);

  const minPrice = parseFloat((listing.price * (1 - strategy.minDiscount)).toFixed(4));
  const concessionPerRound = (listing.price - minPrice) * strategy.concession * round;
  let counterPrice = parseFloat(
    Math.max(minPrice, listing.price - concessionPerRound).toFixed(4)
  );

  let accepted = false;

  if (buyerOffer >= counterPrice) {
    counterPrice = buyerOffer;
    accepted = true;
  }

  if (Math.abs(buyerOffer - counterPrice) <= counterPrice * 0.05 && buyerOffer >= minPrice) {
    counterPrice = parseFloat(((buyerOffer + counterPrice) / 2).toFixed(4));
    accepted = true;
  }

  const responseText = await generateNegotiationResponse(
    listing.seller,
    accepted ? "accepting" : "countering",
    buyerOffer,
    minPrice,
    listing.price,
    counterPrice,
    round,
    accepted
  );

  const message = createX402Message(
    listing.seller,
    buyerAgentId,
    accepted ? "accept" : "counter",
    listing.txId,
    listing.service,
    counterPrice,
    responseText,
    round
  );

  return { message, counterPrice, accepted, reputationScore };
}
