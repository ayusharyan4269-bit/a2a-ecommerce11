import type {
  ParsedIntent,
  OnChainListing,
  NegotiationSession,
  X402Message,
  AgentAction,
} from "@/lib/agents/types";
import { createOffer, createCounterOffer } from "@/lib/agents/buyer-agent";
import { sellerRespond } from "@/lib/agents/seller-agent";
import { verifyZKProof } from "@/lib/blockchain/zk";
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

  let zkVerified = false;
  if (listing.zkProof) {
    const proof = verifyZKProof(listing.zkProof, listing.seller, listing.price);
    zkVerified = proof.valid;
    actions.push(
      createAction(
        "buyer",
        "Buyer Agent",
        "verification",
        `ZK Proof for **${listing.seller}**: ${zkVerified ? "Verified" : "Invalid"} (hash: \`${listing.zkProof}\`)`,
        { zkVerified, hash: listing.zkProof }
      )
    );
  }

  actions.push(
    createAction(
      "buyer",
      "Buyer Agent",
      "thinking",
      `Evaluating listing from **${listing.seller}** — "${listing.service}" at **${listing.price} ALGO** (on-chain TX: \`${listing.txId.slice(0, 16)}...\`)`
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

    actions.push(
      createAction("seller", listing.seller, "negotiation", sellerRes.message.payload.message, {
        price: sellerRes.counterPrice,
        round,
        action: sellerRes.message.action,
      })
    );

    if (sellerRes.accepted) {
      accepted = true;
      finalPrice = sellerRes.counterPrice;
      actions.push(
        createAction("system", "System", "result", `Deal with **${listing.seller}** at **${finalPrice} ALGO**`)
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

  return {
    session: {
      listingTxId: listing.txId,
      sellerAddress: listing.sender,
      sellerName: listing.seller,
      service: listing.service,
      originalPrice: listing.price,
      finalPrice,
      accepted,
      messages,
      zkVerified,
      rounds: messages.length,
    },
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
      `Starting x402-style negotiations with **${listings.length}** on-chain listing(s) for "${intent.serviceType}" (budget: ${intent.maxBudget} ALGO)`
    )
  );

  for (const listing of listings) {
    const { session, actions } = await negotiateWithListing(listing, intent);
    allSessions.push(session);
    allActions.push(...actions);
  }

  const acceptedCount = allSessions.filter((s) => s.accepted).length;
  allActions.push(
    createAction(
      "buyer",
      "Buyer Agent",
      "thinking",
      `Negotiations complete: **${acceptedCount}/${listings.length}** deals reached. Selecting best offer...`
    )
  );

  return { sessions: allSessions, actions: allActions };
}
