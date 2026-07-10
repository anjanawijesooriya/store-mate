import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import logoSrc from "@/public/StoreMate-logo-1.png";
import {
  ShoppingCart,
  Package,
  BarChart3,
  WifiOff,
  MessageSquare,
  Users,
  ArrowRight,
  Check,
  Store,
  Zap,
  TrendingUp,
  AlertTriangle,
  Smartphone,
  Lock,
  Infinity,
  Star,
  Wrench,
  PhoneCall,
  Share2,
  Banknote,
  CreditCard,
} from "lucide-react";

export default async function HomePage() {
  const session = await auth();
  if (session?.user?.shopId) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-[#0a0f0c] text-white">

      {/* ── Navigation ── */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#0a0f0c]/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex items-center justify-between h-16">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoSrc.src}
            alt="StoreMate"
            style={{ height: 120, width: "auto", display: "block" }}
          />
          <nav className="hidden md:flex items-center gap-6 text-sm text-white/60">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-white/70 hover:text-white transition-colors hidden sm:block"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="text-sm font-semibold bg-[#2DA86B] hover:bg-[#27966b] text-white rounded-lg px-4 py-2 transition-colors"
            >
              Start free
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative pt-32 pb-24 px-4 sm:px-6 overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[#2DA86B]/10 rounded-full blur-[120px]" />
          <div className="absolute top-40 left-1/4 w-[300px] h-[300px] bg-[#EA580C]/5 rounded-full blur-[80px]" />
        </div>

        <div className="relative mx-auto max-w-6xl grid lg:grid-cols-2 gap-16 items-center">
          {/* Left — copy */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#2DA86B]/30 bg-[#2DA86B]/10 px-4 py-1.5 text-sm font-medium text-[#2DA86B] mb-6">
              <Zap className="h-3.5 w-3.5" />
              Built for Sri Lankan small businesses
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-bold leading-[1.1] mb-6 tracking-tight">
              Your shop runs smoother{" "}
              <span className="text-[#2DA86B]">with StoreMate</span>
            </h1>

            <p className="text-lg text-white/60 leading-relaxed mb-10 max-w-lg">
              Point of sale, inventory, reports, and customer management — all in
              one app. Works even when the internet is down. Designed for grocery
              shops, pharmacies, clothing stores, and hardware shops across Sri Lanka.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-10">
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 font-bold text-white rounded-xl px-7 py-4 text-base transition-all hover:opacity-90 active:scale-[0.98]"
                style={{ background: "linear-gradient(135deg, #EA580C, #c24a0a)" }}
              >
                Start 14-day free trial
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 font-semibold text-white/80 border border-white/10 rounded-xl px-7 py-4 text-base hover:bg-white/5 hover:text-white transition-colors"
              >
                Log in
              </Link>
            </div>

            <p className="text-sm text-white/30">
              No credit card · LKR 5,000–13,000/mo · Or pay once, own forever
            </p>
          </div>

          {/* Right — mock dashboard card */}
          <div className="relative lg:block">
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 shadow-2xl">
              {/* Mini top bar */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-[#2DA86B] flex items-center justify-center">
                    <Store className="h-3.5 w-3.5 text-white" />
                  </div>
                  <span className="text-sm font-semibold text-white/80">Perera Grocery</span>
                </div>
                <span className="text-xs text-white/30 bg-white/5 rounded-full px-3 py-1">Today</span>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  { label: "Revenue", value: "LKR 45,200", color: "text-[#2DA86B]", up: true },
                  { label: "Sales", value: "38", color: "text-white", up: true },
                  { label: "Low Stock", value: "3 items", color: "text-[#EA580C]", up: false },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl bg-white/5 border border-white/5 p-3">
                    <p className="text-xs text-white/40 mb-1">{s.label}</p>
                    <p className={`text-sm font-bold font-mono ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Mini bar chart */}
              <div className="rounded-xl bg-white/5 border border-white/5 p-4 mb-4">
                <p className="text-xs text-white/40 mb-3">Sales — Last 7 days</p>
                <div className="flex items-end gap-1.5 h-16">
                  {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                    <div key={i} className="flex-1 rounded-t-sm" style={{
                      height: `${h}%`,
                      backgroundColor: i === 5 ? "#2DA86B" : "rgba(45,168,107,0.25)",
                    }} />
                  ))}
                </div>
                <div className="flex justify-between mt-2">
                  {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                    <span key={i} className="text-xs text-white/20 flex-1 text-center">{d}</span>
                  ))}
                </div>
              </div>

              {/* Recent sale rows */}
              <div className="space-y-2">
                <p className="text-xs text-white/30 mb-2">Recent sales</p>
                {[
                  { name: "Rice 5kg × 2", time: "2 min ago", amount: "LKR 1,100" },
                  { name: "Coconut Oil 1L", time: "8 min ago", amount: "LKR 520" },
                  { name: "Sugar 1kg × 3", time: "15 min ago", amount: "LKR 675" },
                ].map((s) => (
                  <div key={s.name} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                    <div>
                      <p className="text-xs font-medium text-white/70">{s.name}</p>
                      <p className="text-xs text-white/25">{s.time}</p>
                    </div>
                    <span className="text-xs font-bold font-mono text-[#2DA86B]">{s.amount}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Floating badge */}
            <div className="absolute -top-4 -right-4 bg-[#EA580C] rounded-xl px-3 py-2 shadow-lg">
              <p className="text-xs font-bold text-white">Works offline</p>
              <div className="flex items-center gap-1 mt-0.5">
                <WifiOff className="h-3 w-3 text-white/70" />
                <span className="text-xs text-white/70">Auto-syncs</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Social proof strip ── */}
      <div className="border-y border-white/5 bg-white/[0.02] py-5 px-4">
        <div className="mx-auto max-w-6xl flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm text-white/30">
          {[
            "Grocery shops",
            "Pharmacies",
            "Clothing stores",
            "Hardware shops",
            "Supermarkets",
            "General stores",
          ].map((t) => (
            <span key={t} className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-[#2DA86B]" />
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* ── Features ── */}
      <section id="features" className="py-24 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-[#2DA86B] uppercase tracking-widest mb-3">Features</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Everything your shop needs
            </h2>
            <p className="text-white/40 max-w-xl mx-auto">
              One app that replaces your ledger book, stock register, and calculator.
              No training required — if you can use a phone, you can use StoreMate.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: ShoppingCart,
                color: "#2DA86B",
                bg: "rgba(45,168,107,0.1)",
                title: "Point of Sale",
                desc: "Ring up a sale in under 30 seconds. Search by name or barcode, hold a sale mid-transaction and resume it later, collect payment, and share the receipt instantly.",
                highlight: true,
              },
              {
                icon: Package,
                color: "#60A5FA",
                bg: "rgba(96,165,250,0.1)",
                title: "Inventory Management",
                desc: "Know your stock at a glance. Get alerts when items run low. Bulk-import your catalog from Excel in minutes.",
                highlight: false,
              },
              {
                icon: BarChart3,
                color: "#A78BFA",
                bg: "rgba(167,139,250,0.1)",
                title: "Sales Reports & P&L",
                desc: "See today's revenue vs yesterday, top-selling products, and a full P&L breakdown. Filter by any custom date range for deep-dive analysis.",
                highlight: false,
              },
              {
                icon: WifiOff,
                color: "#EA580C",
                bg: "rgba(234,88,12,0.1)",
                title: "Offline Mode",
                desc: "Internet cuts out? Keep selling. Sales are queued and sync automatically the moment you reconnect. Nothing is lost.",
                highlight: false,
              },
              {
                icon: Share2,
                color: "#34D399",
                bg: "rgba(52,211,153,0.1)",
                title: "Receipts & Notifications",
                desc: "Share receipts via WhatsApp, email, or a permanent receipt link — free, no SMS cost. Opt in to SMS for low-stock alerts and daily summaries sent straight to your phone.",
                highlight: false,
              },
              {
                icon: Users,
                color: "#FBBF24",
                bg: "rgba(251,191,36,0.1)",
                title: "Customer Management",
                desc: "Tap any customer to see their full profile — contact details, lifetime spend, credit balance owed, and every purchase linked to them. Record payments against outstanding credit.",
                highlight: false,
              },
              {
                icon: Lock,
                color: "#F472B6",
                bg: "rgba(244,114,182,0.1)",
                title: "Device Lock & Access Control",
                desc: "Restrict dashboard access to a single trusted device. Cashiers can only use POS — reports, settings, and expenses stay protected.",
                highlight: false,
              },
              {
                icon: Banknote,
                color: "#FB923C",
                bg: "rgba(251,146,60,0.1)",
                title: "Payroll Management",
                desc: "Manage employee records, track attendance, and calculate monthly salaries including EPF/ETF. Generate payslips you can print or share via WhatsApp.",
                highlight: false,
              },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className={`rounded-2xl border p-6 transition-all ${
                    f.highlight
                      ? "border-[#2DA86B]/30 bg-[#2DA86B]/5"
                      : "border-white/5 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/10"
                  }`}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                    style={{ background: f.bg }}
                  >
                    <Icon className="h-5 w-5" style={{ color: f.color }} />
                  </div>
                  <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-white/40 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="py-24 px-4 sm:px-6 bg-white/[0.02] border-y border-white/5">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-[#2DA86B] uppercase tracking-widest mb-3">How it works</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Up and running in one afternoon
            </h2>
            <p className="text-white/40 max-w-lg mx-auto">
              No technical setup, no complicated onboarding. We help you get started.
            </p>
          </div>

          <div className="relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-8 left-[calc(16.67%-1px)] right-[calc(16.67%-1px)] h-px bg-gradient-to-r from-transparent via-[#2DA86B]/30 to-transparent" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  step: "01",
                  icon: Smartphone,
                  title: "Register your shop",
                  desc: "Sign up with your phone number. No email needed. Your 14-day free trial starts immediately — no card required.",
                },
                {
                  step: "02",
                  icon: Package,
                  title: "Add your products",
                  desc: "Type them in one by one or upload your existing list from Excel. Most shops are set up in under an hour.",
                },
                {
                  step: "03",
                  icon: TrendingUp,
                  title: "Start selling",
                  desc: "Open the POS screen and make your first sale. Your stock updates automatically. Reports fill in from day one.",
                },
              ].map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.step} className="relative text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#2DA86B]/10 border border-[#2DA86B]/20 mb-5">
                      <Icon className="h-7 w-7 text-[#2DA86B]" />
                    </div>
                    <p className="text-xs font-bold text-[#2DA86B] mb-2 tracking-widest">{s.step}</p>
                    <h3 className="font-semibold text-white mb-2 text-lg">{s.title}</h3>
                    <p className="text-sm text-white/40 leading-relaxed">{s.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── Why local businesses trust us ── */}
      <section className="py-24 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-[#2DA86B] uppercase tracking-widest mb-3">Why StoreMate</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Built for Sri Lanka, not borrowed from abroad
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: WifiOff,
                color: "#EA580C",
                title: "Offline-first",
                desc: "Most POS apps break without internet. StoreMate keeps selling and syncs when you reconnect.",
              },
              {
                icon: MessageSquare,
                color: "#2DA86B",
                title: "SMS-native",
                desc: "Alerts and summaries go to your phone via SMS — not email. Because that's how Sri Lankan business owners communicate.",
              },
              {
                icon: AlertTriangle,
                color: "#FBBF24",
                title: "LKR pricing",
                desc: "Priced in rupees, billed locally. No forex confusion, no USD subscription surprises.",
              },
              {
                icon: Store,
                color: "#60A5FA",
                title: "Made for your shop",
                desc: "Designed around how grocery shops, pharmacies, and hardware stores actually work — not how tech companies imagine they do.",
              },
            ].map((c) => {
              const Icon = c.icon;
              return (
                <div key={c.title} className="rounded-2xl border border-white/5 bg-white/[0.03] p-6">
                  <Icon className="h-6 w-6 mb-3" style={{ color: c.color }} />
                  <h3 className="font-semibold text-white mb-2">{c.title}</h3>
                  <p className="text-sm text-white/40 leading-relaxed">{c.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-24 px-4 sm:px-6 bg-white/[0.02] border-y border-white/5">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-[#2DA86B] uppercase tracking-widest mb-3">Pricing</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Simple, honest pricing
            </h2>
            <p className="text-white/40">
              14-day free trial on all plans. No setup fees. No hidden charges.
            </p>
          </div>

          {/* Monthly plans */}
          <p className="text-xs font-bold text-white/30 uppercase tracking-widest mb-4">Monthly subscription</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
            {[
              {
                name: "Basic",
                price: "5,000",
                desc: "For small single-counter shops",
                color: "#60A5FA",
                features: [
                  "1 device / cashier",
                  "Up to 500 products",
                  "POS + hold & resume sales",
                  "Sales reports + custom date range",
                  "WhatsApp & email receipt sharing",
                  "Shareable receipt links",
                  "Low-stock alerts",
                  "Email receipts & notifications",
                ],
                popular: false,
              },
              {
                name: "Standard",
                price: "8,000",
                desc: "For growing shops — most popular",
                color: "#2DA86B",
                features: [
                  "Up to 3 devices",
                  "Unlimited products",
                  "Customer profiles & purchase history",
                  "Sales history filters (method, status, name)",
                  "Expense tracking + P&L",
                  "Offline POS mode",
                  "Device Lock & access control",
                  "Payroll module (add-on)",
                  "SMS add-on available",
                ],
                popular: true,
              },
              {
                name: "Premium",
                price: "13,000",
                desc: "For busy shops needing everything",
                color: "#A78BFA",
                features: [
                  "Unlimited devices",
                  "Advanced analytics",
                  "Card surcharge tracking",
                  "Device Lock & access control",
                  "Payroll module (add-on)",
                  "Priority WhatsApp support",
                  "SMS add-on available",
                  "Everything in Standard",
                ],
                popular: false,
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl p-7 flex flex-col ${
                  plan.popular
                    ? "border-2 border-[#2DA86B] bg-[#2DA86B]/5"
                    : "border border-white/8 bg-white/[0.03]"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#2DA86B] text-white text-xs font-bold px-4 py-1 rounded-full">
                    Most Popular
                  </div>
                )}
                <div className="mb-5">
                  <p className="text-sm font-semibold mb-1" style={{ color: plan.color }}>{plan.name}</p>
                  <div className="flex items-end gap-1 mt-1">
                    <span className="text-4xl font-bold text-white">LKR {plan.price}</span>
                    <span className="text-sm text-white/30 pb-1">/month</span>
                  </div>
                  <p className="text-sm text-white/30 mt-1">{plan.desc}</p>
                </div>
                <ul className="space-y-2.5 flex-1 mb-7">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5 text-sm text-white/60">
                      <Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: plan.color }} />
                      {feat}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className="block text-center text-sm font-bold rounded-xl px-4 py-3 transition-all hover:opacity-90"
                  style={
                    plan.popular
                      ? { background: "#2DA86B", color: "white" }
                      : { border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }
                  }
                >
                  Start free trial
                </Link>
              </div>
            ))}
          </div>

          <p className="text-sm text-white/25 mb-14">
            All plans include a 14-day free trial. Billed monthly in LKR. Cancel anytime.
            SMS notifications available as a credit add-on.
          </p>

          {/* Lifetime / One-time plans */}
          <div className="flex items-center gap-3 mb-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#EAB308]/30 bg-[#EAB308]/10 px-3 py-1 text-xs font-bold text-[#EAB308]">
              <Infinity className="h-3.5 w-3.5" />
              One-time payment — Lifetime access
            </div>
            <div className="flex-1 h-px bg-[#EAB308]/10" />
          </div>

          <p className="text-sm text-white/35 mb-6">
            Same plan tiers, paid once. No monthly bills — ever. Choose the tier that fits your shop and pay a single one-time fee for permanent access.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
            {[
              {
                name: "Basic",
                monthlyRef: "LKR 5,000/mo equivalent",
                desc: "Small single-counter shops",
                color: "#60A5FA",
                features: [
                  "1 device / cashier",
                  "Up to 500 products",
                  "POS + hold & resume sales",
                  "Sales reports + custom date range",
                  "WhatsApp & email receipt sharing",
                  "Shareable receipt links",
                  "Low-stock alerts",
                  "Email receipts & notifications",
                  "1 year free support",
                ],
              },
              {
                name: "Standard",
                monthlyRef: "LKR 8,000/mo equivalent",
                desc: "Growing shops — most popular",
                color: "#2DA86B",
                features: [
                  "Up to 3 devices",
                  "Unlimited products",
                  "Customer profiles & purchase history",
                  "Sales history filters (method, status, name)",
                  "Expense tracking + P&L",
                  "Offline POS mode",
                  "Device Lock & access control",
                  "Payroll module (add-on)",
                  "SMS add-on available",
                  "1 year free support",
                ],
                popular: true,
              },
              {
                name: "Premium",
                monthlyRef: "LKR 13,000/mo equivalent",
                desc: "Busy shops needing everything",
                color: "#A78BFA",
                features: [
                  "Unlimited devices",
                  "Advanced analytics",
                  "Card surcharge tracking",
                  "Device Lock & access control",
                  "Payroll module (add-on)",
                  "Priority WhatsApp support",
                  "SMS add-on available",
                  "Everything in Standard",
                  "1 year free support",
                ],
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl flex flex-col overflow-hidden ${
                  plan.popular
                    ? "border-2 border-[#EAB308]/50 bg-gradient-to-b from-[#EAB308]/8 to-[#EAB308]/3"
                    : "border border-[#EAB308]/15 bg-[#EAB308]/[0.03]"
                }`}
              >
                {/* Top accent line */}
                <div className="h-px w-full" style={{ background: `linear-gradient(90deg, transparent, ${plan.color}50, transparent)` }} />

                {plan.popular && (
                  <div className="absolute -top-0 left-1/2 -translate-x-1/2 bg-[#EAB308] text-[#0a0f0c] text-xs font-bold px-4 py-1 rounded-b-lg">
                    Most Popular
                  </div>
                )}

                <div className="p-7 flex flex-col flex-1">
                  <div className="mb-5 mt-3">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-bold" style={{ color: plan.color }}>{plan.name}</p>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#EAB308] bg-[#EAB308]/10 rounded-full px-2 py-0.5">
                        <Infinity className="h-3 w-3" /> Lifetime
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1.5 mt-2">
                      <span className="text-2xl font-bold text-white">One-time payment</span>
                    </div>
                    <p className="text-xs text-white/25 mt-0.5">{plan.monthlyRef}</p>
                    <p className="text-sm text-white/30 mt-1">{plan.desc}</p>
                  </div>

                  <ul className="space-y-2.5 flex-1 mb-7">
                    {plan.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2.5 text-sm text-white/60">
                        <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-[#EAB308]" />
                        {feat}
                      </li>
                    ))}
                  </ul>

                  <a
                    href="https://wa.me/94775202362"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-center text-sm font-bold rounded-xl px-4 py-3 transition-all hover:opacity-90"
                    style={
                      plan.popular
                        ? { background: "linear-gradient(135deg, #EAB308, #ca9a06)", color: "#0a0f0c" }
                        : { border: "1px solid rgba(234,179,8,0.25)", color: "rgba(234,179,8,0.8)" }
                    }
                  >
                    <span className="flex items-center justify-center gap-2">
                      <PhoneCall className="h-3.5 w-3.5" />
                      Get pricing
                    </span>
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* Add-ons */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <p className="text-xs font-bold text-white/30 uppercase tracking-widest">Available Add-ons</p>
              <div className="flex-1 h-px bg-white/5" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
              {[
                {
                  icon: Banknote,
                  color: "#FB923C",
                  title: "Payroll Module",
                  desc: "Employee records, attendance tracking, EPF/ETF salary calculations, and printable / WhatsApp-shareable payslips. Available on Standard & Premium plans.",
                },
                {
                  icon: Lock,
                  color: "#F472B6",
                  title: "Device Lock",
                  desc: "Pin your shop to a single trusted device. Cashiers get POS-only access — reports, settings, and expenses stay out of reach. Available on Standard & Premium plans.",
                },
                {
                  icon: CreditCard,
                  color: "#60A5FA",
                  title: "Card Surcharge",
                  desc: "Automatically apply a configurable surcharge rate on card payments and track it separately in your P&L. Available on all plans.",
                },
                {
                  icon: MessageSquare,
                  color: "#34D399",
                  title: "SMS Notifications",
                  desc: "Low-stock alerts and daily sales summaries delivered to your phone via SMS. Billed as a credit top-up — pay only for what you use.",
                },
              ].map((addon) => {
                const Icon = addon.icon;
                return (
                  <div key={addon.title} className="flex gap-4 rounded-2xl border border-white/8 bg-white/[0.03] p-5">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${addon.color}18` }}>
                      <Icon className="h-4.5 w-4.5" style={{ color: addon.color }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white mb-1">{addon.title}</p>
                      <p className="text-sm text-white/40 leading-relaxed">{addon.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Maintenance policy note */}
          <div className="rounded-2xl border border-[#EAB308]/15 bg-[#EAB308]/[0.03] px-6 py-5 flex flex-col sm:flex-row gap-5 items-start">
            <div className="w-10 h-10 rounded-xl bg-[#EAB308]/10 border border-[#EAB308]/20 flex items-center justify-center flex-shrink-0">
              <Wrench className="h-5 w-5 text-[#EAB308]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-[#EAB308] mb-2">Maintenance & Support Policy — All Lifetime Plans</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-white/40">
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-[#2DA86B] flex-shrink-0 mt-0.5" />
                  <span><span className="text-white/60 font-medium">Year 1 — Completely free:</span> Software updates, bug fixes, new features, and direct support — all included.</span>
                </div>
                <div className="flex items-start gap-2">
                  <Star className="h-4 w-4 text-[#EAB308] flex-shrink-0 mt-0.5" />
                  <span><span className="text-white/60 font-medium">From Year 2 onwards:</span> Optional annual maintenance of <span className="text-[#EAB308] font-semibold">LKR 5,000 – 10,000</span> keeps your system updated with new features and continued support.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-24 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#2DA86B]/8 rounded-full blur-[100px]" />
        </div>
        <div className="relative mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#2DA86B]/10 border border-[#2DA86B]/20 mb-6">
            <Store className="h-7 w-7 text-[#2DA86B]" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-5">
            Ready to modernize your shop?
          </h2>
          <p className="text-white/40 text-base mb-10 max-w-lg mx-auto leading-relaxed">
            Join shop owners across Sri Lanka who manage their business with StoreMate.
            Start your free trial today — no credit card, no commitment.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 font-bold text-white rounded-xl px-8 py-4 text-base transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, #EA580C, #c24a0a)" }}
            >
              Get started free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center font-semibold text-white/60 rounded-xl px-8 py-4 text-base hover:text-white border border-white/8 hover:bg-white/5 transition-colors"
            >
              Log in to your shop
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 py-10 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoSrc.src}
              alt="StoreMate"
              style={{ height: 98, width: "auto", display: "block", opacity: 0.75, }}
            />
            <span className="text-white/20 text-sm">— Smart shop management</span>
          </div>
          <p className="text-xs text-white/20 order-last sm:order-none">
            © {new Date().getFullYear()} StoreMate. Built for Sri Lankan businesses.
          </p>
          <div className="flex gap-5 text-sm text-white/30">
            <Link href="/login" className="hover:text-white/70 transition-colors">Login</Link>
            <Link href="/register" className="hover:text-white/70 transition-colors">Register</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
