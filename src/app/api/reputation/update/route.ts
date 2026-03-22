/**
 * POST /api/reputation/update
 *
 * A cleaner increment/decrement API instead of raw score 0-100.
 *
 * Body:
 *   senderAddress  — wallet that signs the transaction (the reviewer)
 *   agentAddress   — agent being reviewed
 *   action         — "increment" | "decrement"
 *   magnitude      — optional: "minor" | "standard" | "major" (default: "standard")
 *   reason         — free-text reason (logged in response, not on-chain)
 *
 * Magnitude → score mapping:
 *   increment + minor    → 75  (slight positive)
 *   increment + standard → 85  (good delivery)
 *   increment + major    → 95  (exceptional)
 *   decrement + minor    → 35  (slight issue)
 *   decrement + standard → 20  (bad experience)
 *   decrement + major    → 5   (severe failure)
 *
 * Returns: { unsignedTxn, txnId, action, magnitude, score, reason }
 */

import { NextRequest, NextResponse } from "next/server";
import algosdk from "algosdk";
import { getClient, queryAgentReputation } from "@/lib/blockchain/algorand";

type Action    = "increment" | "decrement";
type Magnitude = "minor" | "standard" | "major";

const SCORE_MAP: Record<Action, Record<Magnitude, number>> = {
  increment: { minor: 75, standard: 85, major: 95 },
  decrement: { minor: 35, standard: 20, major: 5 },
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { senderAddress, agentAddress, action, magnitude = "standard", reason = "" } = body as {
      senderAddress: string;
      agentAddress: string;
      action: Action;
      magnitude?:    Magnitude;
      reason?:       string;
    };

    if (!senderAddress || !agentAddress || !action) {
      return NextResponse.json(
        { error: "senderAddress, agentAddress, action required" },
        { status: 400 }
      );
    }
    if (action !== "increment" && action !== "decrement") {
      return NextResponse.json(
        { error: 'action must be "increment" or "decrement"' },
        { status: 400 }
      );
    }
    if (!["minor", "standard", "major"].includes(magnitude)) {
      return NextResponse.json(
        { error: 'magnitude must be "minor", "standard", or "major"' },
        { status: 400 }
      );
    }

    const appId = process.env.REPUTATION_APP_ID;
    if (!appId) {
      return NextResponse.json({ error: "REPUTATION_APP_ID not configured" }, { status: 500 });
    }

    // Check agent is registered before allowing update
    const currentRep = await queryAgentReputation(agentAddress);
    if (!currentRep?.isRegistered) {
      return NextResponse.json(
        { error: "Agent not registered in reputation contract. Call /api/reputation/register first." },
        { status: 409 }
      );
    }

    const score = SCORE_MAP[action][magnitude as Magnitude];

    const algorand = getClient();
    const algod = algorand.client.algod;
    const params = await algod.getTransactionParams().do();

    const method = algosdk.ABIMethod.fromSignature("submitFeedback(account,uint64)void");
    const selector = new Uint8Array(method.getSelector());

    const boxName = Buffer.concat([
      Buffer.from("a"),
      algosdk.decodeAddress(agentAddress).publicKey,
    ]);

    const txn = algosdk.makeApplicationCallTxnFromObject({
      sender: algosdk.Address.fromString(senderAddress),
      appIndex: BigInt(appId),
      appArgs: [
        selector,
        algosdk.ABIType.from("address").encode(agentAddress),
        algosdk.ABIType.from("uint64").encode(BigInt(score)),
      ],
      boxes: [{ appIndex: BigInt(appId), name: boxName }],
      onComplete: algosdk.OnApplicationComplete.NoOpOC,
      suggestedParams: params,
    });

    const unsignedTxnB64 = Buffer.from(algosdk.encodeUnsignedTransaction(txn)).toString("base64");

    // Estimate new reputation after this update
    const { totalScore, feedbackCount } = currentRep;
    const newTotal = totalScore + score;
    const newCount = feedbackCount + 1;
    const estimatedNewReputation = Math.round((newTotal * 100) / newCount);

    return NextResponse.json({
      unsignedTxn: unsignedTxnB64,
      txnId: txn.txID(),
      action,
      magnitude,
      score,
      reason,
      currentReputation: currentRep.reputation,
      estimatedNewReputation,
      delta: estimatedNewReputation - currentRep.reputation,
      agentAddress,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to build update txn";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
