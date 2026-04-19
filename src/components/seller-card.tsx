"use client";

import type { OnChainListing, NegotiationSession } from "@/lib/agents/types";

interface ListingCardProps {
  listing: OnChainListing;
  negotiation?: NegotiationSession;
  isSelected: boolean;
}

export function ListingCard({ listing, negotiation, isSelected }: ListingCardProps) {
  return (
    <div
      className={`rounded-xl border p-3 transition-all ${
        isSelected
          ? "border-emerald-500/40 bg-emerald-500/5"
          : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white truncate">{listing.seller}</h3>
          <p className="text-[10px] text-zinc-100 mt-0.5">{listing.type}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {listing.zkCommitment && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/15 text-purple-400">
              ZK ✓
            </span>
          )}
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/15 text-blue-400">
            On-Chain
          </span>
        </div>
      </div>

      <p className="text-xs text-zinc-100 leading-relaxed mb-2 line-clamp-2">
        {listing.description}
      </p>

      <div className="text-[10px] text-white mb-2 font-mono truncate">
        TX: {listing.txId.slice(0, 24)}...
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[10px] text-white">Round: {listing.round}</span>
        <div className="text-right">
          {negotiation ? (
            <div>
              <span
                className={`text-sm font-bold ${negotiation.accepted ? "text-emerald-400" : "text-red-400"}`}
              >
                {negotiation.finalPrice} ALGO
              </span>
              <span className="text-[10px] text-white ml-1 line-through">
                {listing.price}
              </span>
            </div>
          ) : (
            <span className="text-sm font-semibold text-zinc-100">
              {listing.price} ALGO
            </span>
          )}
        </div>
      </div>

      {negotiation && (
        <div className="mt-2 pt-2 border-t border-zinc-800/50">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-zinc-100">
              {negotiation.rounds} msg(s) • {negotiation.zkVerified ? "ZK Verified" : "No ZK"}
            </span>
            <span
              className={`font-medium ${negotiation.accepted ? "text-emerald-400" : "text-red-400"}`}
            >
              {negotiation.accepted ? "DEAL" : "NO DEAL"}
            </span>
          </div>
          {negotiation.accepted && (
            <div className="mt-1 text-[10px] text-zinc-100">
              Saved{" "}
              {Math.round(
                ((listing.price - negotiation.finalPrice) / listing.price) * 100
              )}
              % from listed price
            </div>
          )}
        </div>
      )}

      {isSelected && (
        <div className="mt-2 py-1.5 rounded-lg bg-emerald-500/10 text-center">
          <span className="text-[11px] font-semibold text-emerald-400">SELECTED</span>
        </div>
      )}
    </div>
  );
}
