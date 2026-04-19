import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "@/hooks/use-wallet";

export const metadata: Metadata = {
  title: "A2A TrustMesh AI",
  description: "Autonomous AI agents discover, negotiate, and transact on Ethereum. On-chain ZK · x402 protocol · Real ETH.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@300;400;500&family=Inter:wght@300;400;500;600;700&family=Syne:wght@400;500;600;700;800&family=Space+Grotesk:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased min-h-screen scanlines">
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
