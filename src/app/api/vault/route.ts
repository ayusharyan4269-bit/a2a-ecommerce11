/**
 * Vault — Ethereum-native implementation.
 *
 * GET  /api/vault          — vault address + simulated balance
 * POST /api/vault {action:"execute"} — simulate vault auto-payment
 * POST /api/vault {action:"fund"}    — record deposit (actual ETH sent via MetaMask)
 * POST /api/vault {action:"sign"}    — sign arbitrary payload
 */

import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import fs from "fs";
import path from "path";

// ── Vault state (file-persisted) ────────────────────────────────────────────

const VAULT_STATE_FILE = path.join(process.cwd(), ".vault-state.json");

interface VaultState {
  address: string;
  balance: number; // in ETH
  txHistory: { txId: string; amount: number; to: string; ts: number }[];
}

function loadState(): VaultState {
  try {
    if (fs.existsSync(VAULT_STATE_FILE)) {
      return JSON.parse(fs.readFileSync(VAULT_STATE_FILE, "utf-8")) as VaultState;
    }
  } catch { /* fall through */ }
  // Generate a deterministic vault address
  const addr = "0x" + createHash("sha256").update("a2a-vault-eth").digest("hex").slice(0, 40);
  return { address: addr, balance: 0, txHistory: [] };
}

function saveState(state: VaultState) {
  fs.writeFileSync(VAULT_STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

// ── GET: vault info ──────────────────────────────────────────────────────────

export async function GET() {
  try {
    const state = loadState();
    return NextResponse.json({ address: state.address, balance: state.balance });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Vault error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── POST: actions ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body as { action: string };

    // ── Fund vault (record deposit from MetaMask) ─────────────────────
    if (action === "fund") {
      const { amountAlgo, amountEth, txHash } = body as {
        amountAlgo?: number;
        amountEth?: number;
        txHash?: string;
      };
      const amount = amountEth ?? amountAlgo ?? 0;
      const state = loadState();
      state.balance += amount;
      state.txHistory.push({
        txId: txHash ?? "0x" + randomBytes(32).toString("hex"),
        amount,
        to: state.address,
        ts: Date.now(),
      });
      saveState(state);
      return NextResponse.json({ success: true, balance: state.balance, address: state.address });
    }

    // ── Execute payment from vault (auto-sign simulation) ─────────────
    if (action === "execute") {
      const { receiverAddress, amountAlgo, note } = body as {
        receiverAddress: string;
        amountAlgo: number;
        note?: string;
      };
      if (!receiverAddress || !amountAlgo) {
        return NextResponse.json({ error: "receiverAddress and amountAlgo required" }, { status: 400 });
      }

      const state = loadState();

      // Check balance — if insufficient we still allow it (vault is simulated)
      const requiredBalance = amountAlgo + 0.001; // fee
      if (state.balance < requiredBalance && state.balance > 0) {
        return NextResponse.json(
          { error: `Vault has ${state.balance.toFixed(4)} ETH but needs ${amountAlgo} ETH + fees`, balance: state.balance },
          { status: 402 }
        );
      }

      // Simulate signed ETH payment
      const txId = "0x" + createHash("sha256")
        .update(`${receiverAddress}|${amountAlgo}|${Date.now()}|${randomBytes(8).toString("hex")}`)
        .digest("hex");

      const confirmedRound = Math.floor(Date.now() / 1000);

      // Deduct from balance if funded
      if (state.balance >= amountAlgo) {
        state.balance = Math.max(0, state.balance - amountAlgo);
      }
      state.txHistory.push({ txId, amount: amountAlgo, to: receiverAddress, ts: Date.now() });
      saveState(state);

      console.log(`[VAULT] Auto-pay ${amountAlgo} ETH → ${receiverAddress} | TX: ${txId.slice(0, 20)}... | Note: ${note ?? ""}`);

      return NextResponse.json({
        success: true,
        txId,
        confirmedRound,
        amount: amountAlgo,
        vaultBalance: state.balance,
      });
    }

    // ── Sign arbitrary payload with vault ─────────────────────────────
    if (action === "sign") {
      const { payload, reason } = body as { payload?: string; reason?: string };
      const txId = "0x" + createHash("sha256")
        .update(`${payload ?? ""}|${reason ?? ""}|${Date.now()}`)
        .digest("hex");
      console.log(`[VAULT] Signed payload | reason: ${reason ?? "—"} | TX: ${txId.slice(0, 20)}...`);
      return NextResponse.json({ success: true, txId, confirmedRound: Math.floor(Date.now() / 1000) });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Vault operation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
