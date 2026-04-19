import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletConnect } from "@/components/wallet-connect";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navLinks = [
    { label: "OVERVIEW", href: "/" },
    { label: "SELL", href: "/sell" },
    { label: "MARKETPLACE", href: "/marketplace" },
    { label: "VAULT", href: "/vault" },
    { label: "LOOKER", href: "/looker" },
  ];

  const isActive = (path: string) => {
    if (!pathname) return false;
    if (path === "/") {
      return pathname === "/";
    }
    // Matches exact path or nested routes (e.g., /vault or /vault/123)
    // Prevents partial matches (e.g., /market matching /marketplace)
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-inter relative flex flex-col">
      {/* 🧭 STRICT GLOBAL NAVBAR */}
      <nav className="sticky top-0 inset-x-0 z-50 bg-zinc-900 border-b border-zinc-800 shadow-sm backdrop-blur-md bg-opacity-90">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 shrink-0 group">
            <div className="w-8 h-8 rounded border-2 border-cyan-500/50 flex items-center justify-center transition-colors group-hover:border-cyan-400">
               <span className="font-bold text-xs text-cyan-400">A2A</span>
            </div>
            <span className="font-extrabold text-lg tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">TrustMesh AI</span>
          </Link>

          {/* Nav Links */}
          <div className="flex items-center gap-2">
            {navLinks.map((link) => {
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  className={`px-4 py-5 text-xs font-semibold tracking-wider border-b-2 transition-all ${
                    isActive(link.href)
                      ? "text-cyan-400 border-cyan-400 drop-shadow-[0_0_8px_rgba(14,165,233,0.6)] font-bold opacity-100 active-nav" // Active styling
                      : "text-zinc-400 border-transparent hover:text-white hover:border-zinc-700 opacity-60 nav-item" // Inactive styling
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Right Section (Wallet) */}
          <div className="flex items-center shrink-0">
             <WalletConnect />
          </div>
        </div>
      </nav>

      {/* 🧱 STRICT GLOBAL CONTAINER */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
