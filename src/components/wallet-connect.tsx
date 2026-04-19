"use client";

import { useWallet } from "@/hooks/use-wallet";
import { useState, useEffect } from "react";
import { ethers } from "ethers";

function truncateAddr(addr: string): string {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function WalletConnect() {
  const { address, provider, isReady, connect, disconnect } = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!address || !provider) {
      setBalance(null);
      return;
    }
    
    const fetchBalance = async () => {
      try {
        const bal = await provider.getBalance(address);
        setBalance(Number(ethers.formatEther(bal)));
      } catch (err) {
        setBalance(null);
      }
    };
    
    fetchBalance();
  }, [address, provider]);

  if (!isReady) {
    return (
      <div className="px-3 py-1.5 rounded-lg bg-zinc-800/50 border border-zinc-700/50 text-xs text-zinc-100">
        Loading...
      </div>
    );
  }

  if (address) {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-mono text-emerald-300">
            {truncateAddr(address)}
          </span>
          {balance !== null && (
            <span className="text-[10px] text-white">
              {balance.toFixed(4)} ETH
            </span>
          )}
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute right-0 top-full mt-2 w-64 rounded-xl bg-zinc-900 border border-zinc-700 shadow-2xl z-50 overflow-hidden">
              <div className="p-3 border-b border-zinc-800">
                <p className="text-xs text-white">Connected via MetaMask</p>
                <p className="text-sm font-mono text-white mt-1 break-all">
                  {address}
                </p>
                {balance !== null && (
                  <p className="text-sm text-emerald-400 font-medium mt-1">
                    {balance.toFixed(4)} ETH
                  </p>
                )}
              </div>
              <div className="p-2">
                <button
                  onClick={() => { disconnect(); setIsOpen(false); }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={connect}
        className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-medium hover:from-blue-500 hover:to-purple-500 transition-all shadow-lg shadow-blue-500/20"
      >
        Connect MetaMask
      </button>
    </div>
  );
}
