import { Check } from "lucide-react";
import Link from "next/link";
import logoSrc from "@/public/StoreMate-logo-1.png";

const FEATURES = [
  "Full offline POS â€” works even without internet",
  "Inventory tracking with low-stock alerts",
  "Sales reports, P&L, and expense tracking",
  "Customer credit management built-in",
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* â”€â”€ Brand panel (desktop only) â”€â”€ */}
      <div className="hidden lg:flex lg:w-[46%] xl:w-[42%] flex-col bg-[#0a0f0c] p-12 relative overflow-hidden">
        {/* Ambient glows */}
        <div className="absolute top-1/3 -left-16 w-96 h-96 bg-[#2DA86B]/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-0 w-72 h-72 bg-[#EA580C]/5 rounded-full blur-3xl pointer-events-none" />

        {/* Logo */}
        <Link href="/" className="relative z-10 w-fit hover:opacity-80 transition-opacity">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoSrc.src}
            alt="StoreMate"
            style={{ height: 158, width: "auto", display: "block",}}
          />
        </Link>

        {/* Hero copy */}
        <div className="relative z-10 flex-1 flex flex-col justify-center py-16">
          <p className="text-[#2DA86B] text-xs font-bold uppercase tracking-widest mb-4">
            Built for Sri Lanka
          </p>
          <h2 className="text-4xl font-bold text-white leading-tight">
            Your shop, <br />smarter.
          </h2>
          <p className="mt-4 text-gray-400 text-base leading-relaxed max-w-xs">
            Everything a local shop owner needs â€” POS, stock, sales, and reports â€” in one app.
          </p>

          <div className="mt-10 space-y-4">
            {FEATURES.map((f) => (
              <div key={f} className="flex items-start gap-3">
                <div className="mt-0.5 w-5 h-5 rounded-full bg-[#2DA86B]/20 border border-[#2DA86B]/30 flex items-center justify-center flex-shrink-0">
                  <Check className="h-3 w-3 text-[#2DA86B]" />
                </div>
                <span className="text-gray-400 text-sm leading-relaxed">{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Social proof */}
        <div className="relative z-10 pt-6 border-t border-white/5">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {["P", "K", "S", "A"].map((l) => (
                <div
                  key={l}
                  className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2DA86B]/50 to-[#1a6b42]/30 border-2 border-[#0a0f0c] flex items-center justify-center"
                >
                  <span className="text-xs font-semibold text-[#2DA86B]">{l}</span>
                </div>
              ))}
            </div>
            <p className="text-gray-500 text-xs">
              Trusted by shops across Sri Lanka
            </p>
          </div>
        </div>
      </div>

      {/* â”€â”€ Form panel â”€â”€ */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-background min-h-screen">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-10">
            <Link href="/" className="inline-flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoSrc.src} alt="StoreMate" style={{ height: 80, width: "auto" }} />
            </Link>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}

