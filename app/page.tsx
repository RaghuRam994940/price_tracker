import Link from "next/link";
import { Tag, ArrowRight, Bell, Layers, Cpu, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-slate-100 flex flex-col selection:bg-brand selection:text-background">
      {/* Navigation Header */}
      <header className="border-b border-surface-border/70 backdrop-blur-md sticky top-0 z-50 bg-background/80">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-surface-secondary border border-surface-border flex items-center justify-center text-brand shadow-glow">
              <Tag className="w-4 h-4 text-brand" />
            </div>
            <span className="text-xl font-black tracking-tight text-white">VECHI</span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/dashboard"
              className="px-4 py-2 rounded-lg bg-brand hover:bg-brand-hover text-background text-sm font-bold transition-all duration-200 shadow-glow flex items-center gap-1.5"
            >
              <span>Launch Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-28 px-6 overflow-hidden">
        {/* Ambient lighting glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-brand/10 rounded-full blur-[160px] pointer-events-none" />
        <div className="absolute top-1/3 left-1/4 w-[350px] h-[350px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-secondary border border-surface-border text-xs font-semibold text-brand mb-6 shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Autonomous Multi-Store Price Intelligence</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-[1.15] mb-6">
            Never miss a price drop on{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand via-cyan-300 to-emerald-400">
              Croma, Amazon & Flipkart
            </span>
          </h1>

          <p className="text-lg text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
            Vechi monitors dynamic e-commerce listings with a 2-tier headless scraping engine. Set your target price and receive instant, deduplicated transactional alerts via Resend the second the price hits your budget.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-brand hover:bg-brand-hover text-background text-base font-extrabold transition-all duration-200 shadow-glow flex items-center justify-center gap-2.5 active:scale-[0.98]"
            >
              <span>Get Started with Google</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#how-it-works"
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-surface-secondary hover:bg-surface-border text-slate-300 hover:text-white text-base font-semibold border border-surface-border transition-colors flex items-center justify-center"
            >
              How It Works
            </a>
          </div>

          {/* Interactive Mockup Preview Card */}
          <div className="mt-16 text-left max-w-2xl mx-auto glass-panel rounded-2xl p-6 shadow-card border border-surface-border relative">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-surface-border">
              <div>
                <span className="text-xs font-semibold text-brand uppercase tracking-wider">
                  Live Monitoring Example
                </span>
                <h3 className="text-base font-bold text-white mt-0.5">
                  Sony PlayStation 5 Slim Digital Edition
                </h3>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                Target Met (₹5,000 Off)
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div className="bg-background/80 rounded-lg p-3 border border-surface-border">
                <div className="text-xs text-slate-400">Target Budget</div>
                <div className="text-base font-bold text-slate-200 mt-1">₹40,000</div>
              </div>
              <div className="bg-background/80 rounded-lg p-3 border border-surface-border">
                <div className="text-xs text-emerald-400">Lowest Detected</div>
                <div className="text-base font-extrabold text-emerald-400 mt-1">₹37,990</div>
              </div>
              <div className="col-span-2 sm:col-span-1 bg-background/80 rounded-lg p-3 border border-surface-border flex flex-col justify-between">
                <div className="text-xs text-slate-400">Winning Store</div>
                <div className="text-sm font-bold text-brand uppercase mt-1">Croma Online</div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-surface-border/50 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-soft-pulse" />
                Scanned 14 minutes ago via Headless Chromium
              </span>
              <span className="text-slate-400">Alert Dispatched via Resend</span>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Architecture Grid */}
      <section id="how-it-works" className="py-20 px-6 border-t border-surface-border bg-surface/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-extrabold text-white tracking-tight">
              Built for Modern E-Commerce Nuances
            </h2>
            <p className="text-slate-400 text-sm mt-2 max-w-lg mx-auto">
              Single-page frameworks, aggressive hydration, and dynamic DOM states require more than naive regex scrapers.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="glass-panel p-6 rounded-2xl border border-surface-border hover:border-brand/40 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand mb-4">
                <Cpu className="w-5 h-5 text-brand" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">2-Tier Croma Engine</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Fast HTTP extraction scans JSON-LD and Next.js hydration stores; Playwright headless Chromium acts as an immediate fallback for anti-bot barriers.
              </p>
            </div>

            <div className="glass-panel p-6 rounded-2xl border border-surface-border hover:border-brand/40 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand mb-4">
                <Layers className="w-5 h-5 text-brand" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Multi-Store Linking</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Track a single product across Croma, Flipkart, and Amazon concurrently. Vechi flags the lowest active vendor in real time.
              </p>
            </div>

            <div className="glass-panel p-6 rounded-2xl border border-surface-border hover:border-brand/40 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand mb-4">
                <Bell className="w-5 h-5 text-brand" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Deduplicated Resend Alerts</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Zero spam: alerts fire at most once every 24 hours per product drop, formatted in clean responsive HTML with one-click purchase links.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-surface-border py-8 px-6 text-center text-xs text-slate-500">
        <p>&copy; {new Date().getFullYear()} Vechi Price Tracking System. Powered by Next.js, Supabase & Playwright.</p>
      </footer>
    </div>
  );
}
