"use client";

import { useState } from "react";
import { ethers } from "ethers";
import {
  generateSecretKey,
  encryptCredentials,
  buildIpfsPayload,
  fetchAndDecryptFromIpfs,
  type Credentials,
} from "@/lib/market/crypto";

// Minimal ABI for A2AMarket contract interactions
const MARKET_ABI = [
  "function addProduct(string memory _cid, uint256 _price) external",
  "function buyProduct(string memory _cid) external payable",
  "function release(string memory _cid, address _buyerAddr) external",
  "function getProduct(string memory _cid) external view returns (tuple(address seller, string cid, uint256 price, bool exists))",
];

const MARKET_ADDRESS = process.env.NEXT_PUBLIC_MARKET_ADDRESS || "";
const GATEWAY        = "https://gateway.pinata.cloud/ipfs";

// ─────────────────────────────────────────────────────────────────────────────
// SELLER PANEL
// ─────────────────────────────────────────────────────────────────────────────

export function SecureSellerPanel() {
  const [form, setForm]     = useState({ service: "", price: "", email: "", password: "", notes: "" });
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<{ cid: string; key: string } | null>(null);

  const handle = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function handleList(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    setResult(null);

    try {
      if (!window.ethereum) throw new Error("MetaMask not found");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer   = await provider.getSigner();
      const address  = await signer.getAddress();

      // ── Step 1: Encrypt credentials locally ──────────────────────────────────
      setStatus("🔐 Generating AES-256 secret key...");
      const secretKey = generateSecretKey();

      const creds: Credentials = {
        email:    form.email,
        password: form.password,
        notes:    form.notes,
      };

      const encryptedData = encryptCredentials(creds, secretKey);
      const ipfsPayload   = buildIpfsPayload(encryptedData, address, form.service);

      setStatus("📦 Encrypted. Uploading to IPFS — credentials never leave your device in plaintext...");

      // ── Step 2: Upload encrypted blob to IPFS ────────────────────────────────
      const pinRes  = await fetch("/api/ipfs/pin", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(ipfsPayload),
      });

      if (!pinRes.ok) throw new Error("IPFS upload failed: " + (await pinRes.text()));
      const { IpfsHash: cid } = await pinRes.json();

      setStatus(`📍 Pinned to IPFS: ${cid}\n\n🔑 Registering key with backend...`);

      // ── Step 3: Register key with backend (key-exchange, Step 3 of plan) ─────
      await fetch("/api/market/register-key", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ cid, secretKey, sellerAddress: address }),
      });

      setStatus("⛓ Key stored. Calling A2AMarket.addProduct() via MetaMask...");

      // ── Step 4: Register CID + price on-chain ────────────────────────────────
      const contract  = new ethers.Contract(MARKET_ADDRESS, MARKET_ABI, signer);
      const priceWei  = ethers.parseEther(form.price);
      const tx        = await contract.addProduct(cid, priceWei);
      await tx.wait();

      setStatus(`✅ Product listed on-chain!\nCID: ${cid}`);
      setResult({ cid, key: secretKey });
      setForm({ service: "", price: "", email: "", password: "", notes: "" });
    } catch (err: any) {
      setStatus(`❌ ${err.message}`);
    }
    setLoading(false);
  }

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 space-y-4 max-w-xl">
      <h2 className="text-xl font-bold text-green-400 font-mono">🔒 Secure Seller Panel</h2>
      <p className="text-xs text-gray-500">Credentials are AES-256 encrypted locally before touching IPFS. Nothing is stored in plaintext.</p>

      <form onSubmit={handleList} className="space-y-3">
        {[
          { name: "service",  placeholder: "Service name (e.g. Netflix)",  type: "text" },
          { name: "price",    placeholder: "Price in ETH (e.g. 0.01)",     type: "text" },
          { name: "email",    placeholder: "Email / Username",              type: "email" },
          { name: "password", placeholder: "Password",                      type: "password" },
        ].map(({ name, placeholder, type }) => (
          <input
            key={name}
            name={name}
            type={type}
            placeholder={placeholder}
            value={(form as any)[name]}
            onChange={handle}
            required
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
          />
        ))}
        <textarea
          name="notes"
          placeholder="Notes (optional)"
          value={form.notes}
          onChange={handle}
          rows={2}
          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white font-bold py-2 rounded-lg transition"
        >
          {loading ? "Processing..." : "Encrypt → Upload → List"}
        </button>
      </form>

      {status && (
        <pre className="bg-gray-950 text-green-300 text-xs p-4 rounded-lg whitespace-pre-wrap border border-gray-700">
          {status}
        </pre>
      )}

      {result && (
        <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-4 space-y-1">
          <p className="text-yellow-400 font-bold text-xs">⚠️ SAVE THIS KEY — it will not be shown again here</p>
          <p className="font-mono text-xs text-yellow-200 break-all">CID: {result.cid}</p>
          <p className="font-mono text-xs text-yellow-200 break-all">KEY: {result.key}</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BUYER PANEL
// ─────────────────────────────────────────────────────────────────────────────

export function SecureBuyerPanel() {
  const [cid, setCid]           = useState("");
  const [loading, setLoading]   = useState(false);
  const [status, setStatus]     = useState<string | null>(null);
  const [creds, setCreds]       = useState<Credentials | null>(null);

  async function handleBuy() {
    if (!cid.trim()) return;
    setLoading(true);
    setStatus(null);
    setCreds(null);

    try {
      if (!window.ethereum) throw new Error("MetaMask not found");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer   = await provider.getSigner();
      const contract = new ethers.Contract(MARKET_ADDRESS, MARKET_ABI, signer);

      // ── Step 1: Fetch on-chain price ────────────────────────────────────────
      setStatus("🔍 Fetching product from contract...");
      const product = await contract.getProduct(cid);
      if (!product.exists) throw new Error("Product not found on-chain");

      setStatus(`💰 Price: ${ethers.formatEther(product.price)} ETH\n\n⛓ Sending payment to escrow via MetaMask...`);

      // ── Step 2: Pay via buyProduct ───────────────────────────────────────────
      const tx = await contract.buyProduct(cid, { value: product.price });
      await tx.wait();
      const buyerAddr = await signer.getAddress();

      setStatus(`✅ Payment confirmed!\n\n🔑 Fetching decryption key from backend...`);

      // ── Step 3: Fetch decryption key from key-exchange backend ───────────────
      //    Backend verifies buyer paid by checking the contract before releasing key
      const keyRes = await fetch(`/api/market/get-key?cid=${encodeURIComponent(cid)}&buyer=${buyerAddr}`);
      if (!keyRes.ok) {
        const err = await keyRes.json();
        throw new Error("Key fetch failed: " + err.error);
      }
      const { secretKey } = await keyRes.json();

      setStatus(`🔑 Key received.\n\n📦 Fetching encrypted data from IPFS & decrypting...`);

      // ── Step 4: Fetch IPFS + Decrypt ────────────────────────────────────────
      const decrypted = await fetchAndDecryptFromIpfs(cid, secretKey);
      setCreds(decrypted);

      setStatus("✅ Credentials decrypted successfully!");
    } catch (err: any) {
      setStatus(`❌ ${err.message}`);
    }
    setLoading(false);
  }

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 space-y-4 max-w-xl">
      <h2 className="text-xl font-bold text-blue-400 font-mono">🛒 Secure Buyer Panel</h2>
      <p className="text-xs text-gray-500">Funds go only to the seller wallet stored in the contract — not from any input field.</p>

      <div className="flex gap-2">
        <input
          value={cid}
          onChange={(e) => setCid(e.target.value)}
          placeholder="IPFS CID of product"
          className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={handleBuy}
          disabled={loading || !cid}
          className="bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg transition"
        >
          {loading ? "..." : "Buy"}
        </button>
      </div>

      {status && (
        <pre className="bg-gray-950 text-cyan-300 text-xs p-4 rounded-lg whitespace-pre-wrap border border-gray-700">
          {status}
        </pre>
      )}

      {creds && (
        <div className="bg-green-900/30 border border-green-600 rounded-lg p-4 space-y-1">
          <p className="text-green-400 font-bold text-xs">🔓 Decrypted Credentials</p>
          <p className="font-mono text-xs text-green-200">Email: {creds.email}</p>
          <p className="font-mono text-xs text-green-200">Password: {creds.password}</p>
          {creds.notes && <p className="font-mono text-xs text-green-300">Notes: {creds.notes}</p>}
        </div>
      )}
    </div>
  );
}
