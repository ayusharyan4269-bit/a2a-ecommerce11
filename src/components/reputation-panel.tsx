"use client";

import { useState } from "react";
import { useWallet } from "@/hooks/use-wallet";
import { ethers } from "ethers";

interface ReputationData {
  agent: string;
  isRegistered: boolean;
  reputation: number;
  feedbackCount: number;
  totalScore: number;
  isActive: boolean;
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(score / 100, 100);
  const color = pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function ReputationPanel() {
  const { address, signer } = useWallet();
  const [queryAddr, setQueryAddr] = useState("");
  const [repData, setRepData] = useState<ReputationData | null>(null);
  const [isQuerying, setIsQuerying] = useState(false);
  const [feedback, setFeedback] = useState({ agentAddr: "", score: 85 });
  const [actionLog, setActionLog] = useState<string[]>([]);
  const [isActing, setIsActing] = useState(false);

  function log(msg: string) {
    setActionLog((prev) => [...prev, `${new Date().toLocaleTimeString()} — ${msg}`]);
  }

  async function queryReputation() {
    const addr = queryAddr || address;
    if (!addr) return;
    setIsQuerying(true);
    try {
      const res = await fetch(`/api/reputation/query?agent=${addr}`);
      const data = await res.json();
      setRepData(data);
      log(`Queried ${addr.slice(0, 8)}... — ${data.isRegistered ? `Score: ${data.reputation / 100}/100` : "Not registered"}`);
    } catch (e) {
      log(`Query failed: ${e instanceof Error ? e.message : "unknown"}`);
    }
    setIsQuerying(false);
  }

  async function sendMockTransaction(label: string) {
    if (!signer || !address) throw new Error("Wallet not connected");
    // Send a 0 ETH transaction to self as a mock for registering on chain
    const tx = await signer.sendTransaction({
      to: address,
      value: ethers.parseEther("0"),
    });
    log(`Transaction sent. Waiting for confirmation...`);
    const receipt = await tx.wait();
    if (receipt) {
      log(`${label} confirmed — Block ${receipt.blockNumber}`);
      return receipt;
    }
    throw new Error("Transaction failed");
  }

  async function registerAgent() {
    if (!address || !signer) return;
    setIsActing(true);
    try {
      log("Building register transaction...");
      await sendMockTransaction("Registration");
      setQueryAddr(address);
      await queryReputation();
    } catch (e) {
      log(`Register failed: ${e instanceof Error ? e.message : "unknown"}`);
    }
    setIsActing(false);
  }

  async function submitFeedback() {
    if (!address || !signer || !feedback.agentAddr) return;
    setIsActing(true);
    try {
      log(`Building feedback transaction (score: ${feedback.score})...`);
      const tx = await signer.sendTransaction({
        to: feedback.agentAddr,
        value: ethers.parseEther("0"),
      });
      log(`Transaction sent. Waiting for confirmation...`);
      const receipt = await tx.wait();
      if (receipt) {
        log(`Feedback confirmed — Block ${receipt.blockNumber}`);
      }
    } catch (e) {
      log(`Feedback failed: ${e instanceof Error ? e.message : "unknown"}`);
    }
    setIsActing(false);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Query Reputation</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={queryAddr}
            onChange={(e) => setQueryAddr(e.target.value)}
            placeholder={address ? `${address.slice(0, 16)}... (your wallet)` : "Ethereum address"}
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:border-zinc-600 transition-colors"
          />
          <button
            onClick={queryReputation}
            disabled={isQuerying}
            className="px-4 py-2 rounded-lg bg-zinc-800 text-xs text-zinc-100 hover:bg-zinc-700 border border-zinc-700/50 transition-colors disabled:opacity-50"
          >
            {isQuerying ? "..." : "Query"}
          </button>
        </div>

        {repData && (
          <div className="border border-zinc-800/60 rounded-xl p-4 space-y-3 animate-fade-in-up">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-100 font-mono">{repData.agent.slice(0, 12)}...{repData.agent.slice(-6)}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${repData.isRegistered ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-800 text-zinc-100"}`}>
                {repData.isRegistered ? "Registered" : "Not Registered"}
              </span>
            </div>
            {repData.isRegistered && (
              <>
                <div>
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-2xl font-bold text-zinc-100">{(repData.reputation / 100).toFixed(1)}</span>
                    <span className="text-[10px] text-zinc-100">{repData.feedbackCount} review{repData.feedbackCount !== 1 ? "s" : ""}</span>
                  </div>
                  <ScoreBar score={repData.reputation / 100} />
                </div>
                <div className="flex items-center gap-3 text-[10px] text-zinc-100">
                  <span>Total Score: {repData.totalScore}</span>
                  <span>{repData.isActive ? "Active" : "Inactive"}</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {address && (
        <>
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Register as Agent</h3>
            <button
              onClick={registerAgent}
              disabled={isActing}
              className="w-full py-2.5 rounded-lg bg-zinc-800 text-xs text-zinc-100 hover:bg-zinc-700 border border-zinc-700/50 transition-colors disabled:opacity-50"
            >
              {isActing ? "Signing..." : "Register My Wallet"}
            </button>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Submit Feedback</h3>
            <input
              type="text"
              value={feedback.agentAddr}
              onChange={(e) => setFeedback((prev) => ({ ...prev, agentAddr: e.target.value }))}
              placeholder="Agent address to review"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:border-zinc-600 transition-colors"
            />
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={100}
                value={feedback.score}
                onChange={(e) => setFeedback((prev) => ({ ...prev, score: Number(e.target.value) }))}
                className="flex-1 accent-blue-500"
              />
              <span className="text-sm font-bold text-white w-10 text-right">{feedback.score}</span>
            </div>
            <button
              onClick={submitFeedback}
              disabled={isActing || !feedback.agentAddr}
              className="w-full py-2.5 rounded-lg bg-blue-600 text-xs text-white font-medium hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:bg-zinc-700"
            >
              {isActing ? "Signing..." : "Submit Feedback"}
            </button>
          </div>
        </>
      )}

      {actionLog.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Activity Log</h3>
          <div className="max-h-40 overflow-y-auto scrollbar-thin space-y-1 bg-zinc-900/50 rounded-lg p-3 border border-zinc-800/40">
            {actionLog.map((entry, i) => (
              <p key={i} className="text-[10px] font-mono text-zinc-100 leading-relaxed">{entry}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
