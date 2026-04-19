"use client";

import type { NegotiationSession } from "@/lib/agents/types";

interface NegotiationTimelineProps {
  sessions: NegotiationSession[];
}

export function NegotiationTimeline({ sessions }: NegotiationTimelineProps) {
  if (sessions.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
        x402 Negotiation Log
      </h3>
      {sessions.map((session) => (
        <div key={session.listingTxId} className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-100">{session.sellerName}</span>
            <div className="flex items-center gap-1.5">
              {session.zkVerified && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">ZK</span>
              )}
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded ${session.accepted ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}
              >
                {session.accepted ? "Accepted" : "Rejected"}
              </span>
            </div>
          </div>
          <div className="relative pl-4 space-y-1.5">
            <div className="absolute left-1.5 top-0 bottom-0 w-px bg-zinc-800" />
            {session.messages.map((msg) => (
              <div key={msg.id} className="relative">
                <div
                  className={`absolute -left-[10.5px] top-1 w-2.5 h-2.5 rounded-full border-2 ${
                    msg.action === "accept"
                      ? "border-emerald-500 bg-emerald-500/20"
                      : msg.action === "offer"
                        ? "border-blue-500 bg-blue-500/20"
                        : msg.action === "counter"
                          ? "border-amber-500 bg-amber-500/20"
                          : "border-red-500 bg-red-500/20"
                  }`}
                />
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-medium uppercase ${
                    msg.action === "accept" ? "text-emerald-400"
                      : msg.action === "offer" ? "text-blue-400"
                        : msg.action === "counter" ? "text-amber-400"
                          : "text-red-400"
                  }`}>
                    {msg.action}
                  </span>
                  <span className="text-[10px] text-zinc-100">{msg.from}</span>
                  <span className="text-[10px] text-zinc-100 font-medium">{msg.payload.price} ALGO</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-white pt-1">
            <span>{session.originalPrice} → {session.finalPrice} ALGO</span>
            {session.accepted && (
              <span className="text-emerald-400">
                -{Math.round(((session.originalPrice - session.finalPrice) / session.originalPrice) * 100)}%
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
