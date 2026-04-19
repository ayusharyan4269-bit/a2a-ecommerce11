import { SecureSellerPanel, SecureBuyerPanel } from "@/components/market/SecureMarket";

export const metadata = {
  title: "Secure Market — A2A TrustMesh",
  description: "Buy and sell credentials securely using AES-256 encryption + IPFS + on-chain escrow",
};

export default function SecureMarketPage() {
  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="border-b border-gray-800 pb-6">
          <h1 className="text-3xl font-bold font-mono text-white">
            🔐 Secure Credential Marketplace
          </h1>
          <p className="text-gray-400 mt-2 text-sm">
            Credentials are AES-256 encrypted in your browser before touching IPFS.
            Funds go only to the seller registered on-chain — never from a frontend input.
          </p>
        </div>

        {/* Security flow diagram */}
        <div className="grid grid-cols-5 gap-2 text-center text-xs text-gray-400 items-center">
          {[
            { label: "Encrypt\n(Browser)", color: "text-green-400 border-green-800" },
            { label: "→", color: "" },
            { label: "Upload\nciphertext\nto IPFS", color: "text-blue-400 border-blue-800" },
            { label: "→", color: "" },
            { label: "CID +\nprice\non-chain", color: "text-purple-400 border-purple-800" },
          ].map((s, i) =>
            s.label === "→" ? (
              <div key={i} className="text-gray-600 text-xl">→</div>
            ) : (
              <div key={i} className={`border rounded-lg p-2 whitespace-pre-line ${s.color}`}>
                {s.label}
              </div>
            )
          )}
        </div>
        <div className="grid grid-cols-5 gap-2 text-center text-xs text-gray-400 items-center">
          {[
            { label: "Pay\nbuyProduct()", color: "text-yellow-400 border-yellow-800" },
            { label: "→", color: "" },
            { label: "Backend\nverifies\non-chain", color: "text-orange-400 border-orange-800" },
            { label: "→", color: "" },
            { label: "Decrypt\nin Browser", color: "text-green-400 border-green-800" },
          ].map((s, i) =>
            s.label === "→" ? (
              <div key={i} className="text-gray-600 text-xl">→</div>
            ) : (
              <div key={i} className={`border rounded-lg p-2 whitespace-pre-line ${s.color}`}>
                {s.label}
              </div>
            )
          )}
        </div>

        {/* Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <SecureSellerPanel />
          <SecureBuyerPanel />
        </div>

        {/* Security guarantees */}
        <div className="border border-gray-800 rounded-xl p-6 space-y-3">
          <h3 className="text-sm font-bold text-gray-300 font-mono">SECURITY GUARANTEES</h3>
          <ul className="text-xs text-gray-500 space-y-2 list-none">
            {[
              ["✅", "Credentials AES-256 encrypted in browser — plaintext never leaves your device"],
              ["✅", "IPFS stores only ciphertext — no one can read credentials without the key"],
              ["✅", "Seller wallet locked via msg.sender at listing — frontend cannot spoof it"],
              ["✅", "Funds held in escrow — transferred only to on-chain registered seller address"],
              ["✅", "Backend verifies escrow[cid][buyer].amount > 0 before releasing key"],
              ["✅", "Key released only once per buyer — refunded escrow blocks key access"],
              ["🚫", "No plaintext credentials on blockchain, IPFS, database, or network traffic"],
              ["🚫", "No hardcoded private keys — all signing done via MetaMask"],
            ].map(([icon, text], i) => (
              <li key={i} className="flex gap-2">
                <span>{icon}</span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
