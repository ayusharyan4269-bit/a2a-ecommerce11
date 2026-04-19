"use client";

import type { EscrowState } from "@/lib/agents/types";

interface TransactionStatusProps {
  escrow: EscrowState;
}

export function TransactionStatus({ escrow }: TransactionStatusProps) {
  if (escrow.status === "idle") return null;

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
        On-Chain Transaction
      </h3>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 space-y-2">
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2 text-center mb-2">
          <span className="text-[11px] font-semibold text-emerald-400">
            Payment Confirmed
          </span>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px]">
            <span className="text-zinc-100">Amount</span>
            <span className="text-zinc-100 font-medium">{escrow.amount} ALGO</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-zinc-100">Confirmed Round</span>
            <span className="text-zinc-100 font-mono">{escrow.confirmedRound}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-zinc-100">TX ID</span>
            <span className="text-zinc-100 font-mono text-right max-w-[160px] truncate">
              {escrow.txId}
            </span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-zinc-100">Buyer</span>
            <span className="text-zinc-100 font-mono">
              {escrow.buyerAddress.slice(0, 8)}...{escrow.buyerAddress.slice(-4)}
            </span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-zinc-100">Seller</span>
            <span className="text-zinc-100 font-mono">
              {escrow.sellerAddress.slice(0, 8)}...{escrow.sellerAddress.slice(-4)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
