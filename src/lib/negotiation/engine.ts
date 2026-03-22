import type {
  ParsedIntent,
  OnChainListing,
  NegotiationSession,
  X402Message,
  AgentAction,
} from "@/lib/agents/types";
import { createOffer, createCounterOffer, computeDealScore } from "@/lib/agents/buyer-agent";
import { sellerRespond } from "@/lib/agents/seller-agent";
import { verifyZKCommitment, verifyZKOnChain } from "@/lib/blockchain/zk";
import { getSellerSecret } from "@/lib/blockchain/listings";
import { createAction } from "@/lib/a2a/messaging";

const MAX_ROUNDS = 2;

async function negotiateWithListing(
  listing: OnChainListing,
  intent: ParsedIntent
): Promise<{ session: NegotiationSession; actions: AgentAction[] }> {
  const messages: X402Message[] = [];
  const actions: AgentAction[] = [];
  let accepted = false;
  let finalPrice = listing.price;
  let lastSellerPrice = listing.price;
  let reputationScore = 0;

  let zkVerified = false;
  if (listing.zkCommitment) {
    // Try local secret first (seed listings only)
    const secret = getSellerSecret(listing.seller);
    if (secret) {
      zkVerified = verifyZKCommitment(
        listing.zkCommitment,
        secret,
        listing.seller,
        listing.price,
        listing.description
      );
    }

    // Fall back to on-chain verification via ZKCommitment contract
    if (!zkVerified) {
      try {
        const onChainStatus = await verifyZKOnChain(listing.zkCommitment);
        // 1 = committed (hash exists on-chain), 2 = revealed & verified
        zkVerified = onChainStatus >= 1;
      } catch {
        // on-chain check failed — leave as unverified
      }
    }

    actions.push(
      createAction(
        "buyer",
        "Buyer Agent",
        "verification",
        `SHA-256 ZK for **${listing.seller}**: ${zkVerified ? "Verified ✓" : "Unverified"} (commitment: \`${listing.zkCommitment.slice(0, 24)}...\`)`,
        { zkVerified, commitment: listing.zkCommitment }
      )
    );
  }

  actions.push(
    createAction(
      "buyer",
      "Buyer Agent",
      "thinking",
      `Evaluating listing from **${listing.seller}** — "${listing.service}" at **${listing.price} ALGO** (TX: \`${listing.txId.slice(0, 16)}...\`). Querying on-chain reputation...`
    )
  );

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    let buyerMsg: X402Message;
    let buyerOffer: number;

    if (round === 1) {
      const offer = createOffer(listing, intent);
      buyerMsg = offer.message;
      buyerOffer = offer.offerPrice;
    } else {
      const counter = createCounterOffer(listing, lastSellerPrice, intent, round);
      buyerMsg = counter.message;
      buyerOffer = counter.offerPrice;

      if (counter.accepting) {
        messages.push(buyerMsg);
        accepted = true;
        finalPrice = buyerOffer;
        actions.push(
          createAction("buyer", "Buyer Agent", "negotiation", buyerMsg.payload.message, {
            price: buyerOffer,
            round,
            action: "accept",
          })
        );
        break;
      }
    }

    messages.push(buyerMsg);
    actions.push(
      createAction("buyer", "Buyer Agent", "negotiation", buyerMsg.payload.message, {
        price: buyerOffer,
        round,
        action: buyerMsg.action,
      })
    );

    const sellerRes = await sellerRespond(listing, buyerOffer, round, "buyer-agent");
    messages.push(sellerRes.message);
    lastSellerPrice = sellerRes.counterPrice;
    reputationScore = sellerRes.reputationScore;

    // Log reputation-aware seller response
    actions.push(
      createAction("seller", listing.seller, "negotiation", sellerRes.message.payload.message, {
        price: sellerRes.counterPrice,
        round,
        action: sellerRes.message.action,
        reputationScore,
      })
    );

    if (round === 1) {
      actions.push(
        createAction(
          "system",
          "AgentReputation",
          "verification",
          `**${listing.seller}** reputation: **${reputationScore}/100** ` +
          `(${reputationScore >= 85 ? "High — negotiating firmly" : reputationScore >= 70 ? "Good — standard strategy" : reputationScore >= 50 ? "Average — more concessions" : "Low — aggressive discounting"})`,
          { reputationScore, seller: listing.seller }
        )
      );
    }

    if (sellerRes.accepted) {
      accepted = true;
      finalPrice = sellerRes.counterPrice;
      actions.push(
        createAction("system", "System", "result",
          `Deal with **${listing.seller}** at **${finalPrice} ALGO** (reputation: ${reputationScore}/100)`)
      );
      break;
    }

    if (round === MAX_ROUNDS && lastSellerPrice <= intent.maxBudget) {
      accepted = true;
      finalPrice = lastSellerPrice;
      const acceptMsg: X402Message = {
        id: crypto.randomUUID(),
        from: "buyer-agent",
        to: listing.seller,
        action: "accept",
        payload: {
          listingTxId: listing.txId,
          service: listing.service,
          price: lastSellerPrice,
          message: `Final round — accepting ${lastSellerPrice} ALGO.`,
          round,
        },
        timestamp: new Date().toISOString(),
      };
      messages.push(acceptMsg);
      actions.push(
        createAction("buyer", "Buyer Agent", "negotiation", acceptMsg.payload.message, {
          price: lastSellerPrice,
          round,
          action: "accept",
        })
      );
    }
  }

  const session: Omit<NegotiationSession, "dealScore"> = {
    listingTxId:   listing.txId,
    sellerAddress: listing.sender,
    sellerName:    listing.seller.length >= 58 && /^[A-Z2-7]+$/.test(listing.seller) ? listing.service : listing.seller,
    service:       listing.service,
    originalPrice: listing.price,
    finalPrice,
    accepted,
    messages,
    zkVerified,
    rounds:         messages.length,
    reputationScore,
  };

  return {
    session: { ...session, dealScore: computeDealScore(session) },
    actions,
  };
}

export async function runNegotiations(
  listings: OnChainListing[],
  intent: ParsedIntent
): Promise<{ sessions: NegotiationSession[]; actions: AgentAction[] }> {
  const allSessions: NegotiationSession[] = [];
  const allActions: AgentAction[] = [];

  allActions.push(
    createAction(
      "buyer",
      "Buyer Agent",
      "thinking",
      `Starting x402-style negotiations with **${listings.length}** on-chain listing(s) for "${intent.serviceType}" (budget: ${intent.maxBudget} ALGO). Each seller's strategy is adjusted by their on-chain reputation.`
    )
  );

  for (const listing of listings) {
    const { session, actions } = await negotiateWithListing(listing, intent);
    allSessions.push(session);
    allActions.push(...actions);
  }

  const acceptedSessions = allSessions.filter((s) => s.accepted);
  allActions.push(
    createAction(
      "buyer",
      "Buyer Agent",
      "thinking",
      `Negotiations complete: **${acceptedSessions.length}/${listings.length}** deals reached.\n` +
      (acceptedSessions.length > 0
        ? `Ranking by deal score (60% discount + 40% reputation):\n` +
          [...acceptedSessions]
            .sort((a, b) => b.dealScore - a.dealScore)
            .map((s, i) => `${i + 1}. **${s.sellerName}** — ${s.finalPrice} ALGO  rep=${s.reputationScore}/100  score=${s.dealScore.toFixed(3)}`)
            .join("\n")
        : "No deals within budget.")
    )
  );

  return { sessions: allSessions, actions: allActions };
}
