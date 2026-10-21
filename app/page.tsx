import Link from "next/link";
import { Tag, ArrowRight, Bell, Layers, Cpu, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-slate-100 flex flex-col selection:bg-brand selection:text-background overflow-x-hidden">
      {/* Navigation Header */}
      <header className="border-b border-surface-border/70 backdrop-blur-md sticky top-0 z-50 bg-background/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-surface-secondary border border-surface-border flex items-center justify-center text-brand shadow-glow shrink-0">
              <Tag className="w-4 h-4 text-brand" />
            </div>
            <span className="text-lg sm:text-xl font-black tracking-tight text-white">VECHI</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/login"
              className="text-xs sm:text-sm font-medium text-slate-300 hover:text-white px-2.5 py-1.5 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/dashboard"
              className="px-3 sm:px-4 py-2 rounded-xl bg-brand hover:bg-brand-hover text-background text-xs sm:text-sm font-bold transition-all duration-200 shadow-glow flex items-center gap-1.5 shrink-0"
            >
              <span className="hidden xs:inline">Launch</span>
              <span>Console</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-12 sm:pt-20 pb-16 sm:pb-28 px-4 sm:px-6 overflow-hidden">
        {/* Ambient lighting glows (constrained to prevent horizontal scrollbars on mobile) */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] sm:w-[700px] h-[300px] sm:h-[500px] bg-brand/10 rounded-full blur-[100px] sm:blur-[160px] pointer-events-none" />
        <div className="absolute top-1/3 left-1/4 w-[200px] sm:w-[350px] h-[200px] sm:h-[350px] bg-emerald-500/5 rounded-full blur-[80px] sm:blur-[120px] pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-secondary border border-surface-border text-[11px] sm:text-xs font-semibold text-brand mb-6 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>Autonomous Multi-Store Price Intelligence</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-white leading-[1.18] sm:leading-[1.15] mb-5 sm:mb-6">
            Never miss a price drop on{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand via-cyan-300 to-emerald-400">
              Croma, Amazon & Flipkart
            </span>
          </h1>

          <p className="text-sm sm:text-base md:text-lg text-slate-300 max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed px-2">
            Vechi monitors dynamic e-commerce listings with a 2-tier headless scraping engine. Set your target price and receive instant transactional alerts via Resend straight to your Gmail the second the price hits your budget.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 max-w-md sm:max-w-none mx-auto">
            <Link
              href="/dashboard"
              className="w-full sm:w-auto px-6 sm:px-8 py-3.5 rounded-xl bg-brand hover:bg-brand-hover text-background text-sm sm:text-base font-extrabold transition-all duration-200 shadow-glow flex items-center justify-center gap-2.5 active:scale-[0.98]"
            >
              <span>Get Started with Google</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </Link>
            <a
              href="#how-it-works"
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-surface-secondary hover:bg-surface-border text-slate-300 hover:text-white text-sm sm:text-base font-semibold border border-surface-border transition-colors flex items-center justify-center"
            >
              How It Works
            </a>
          </div>

          {/* Interactive Mockup Preview Card */}
          <div className="mt-12 sm:mt-16 text-left max-w-2xl mx-auto glass-panel rounded-2xl p-4 sm:p-6 shadow-card border border-surface-border relative">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-4 mb-4 border-b border-surface-border">
              <div className="min-w-0">
                <span className="text-[10px] sm:text-xs font-semibold text-brand uppercase tracking-wider block">
                  Live Monitoring Example
                </span>
                <h3 className="text-sm sm:text-base font-bold text-white mt-0.5 truncate">
                  Sony PlayStation 5 Slim Digital Edition
                </h3>
              </div>
              <span className="self-start sm:self-auto px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] sm:text-xs font-bold shrink-0">
                Target Met (₹5,000 Off)
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 text-sm">
              <div className="bg-background/80 rounded-xl p-3 border border-surface-border">
                <div className="text-[10px] sm:text-xs text-slate-400 font-medium">Target Budget</div>
                <div className="text-sm sm:text-base font-bold text-slate-200 mt-0.5">₹40,000</div>
              </div>
              <div className="bg-background/80 rounded-xl p-3 border border-surface-border">
                <div className="text-[10px] sm:text-xs text-emerald-400 font-medium">Lowest Detected</div>
                <div className="text-sm sm:text-base font-extrabold text-emerald-400 mt-0.5">₹37,990</div>
              </div>
              <div className="col-span-2 sm:col-span-1 bg-background/80 rounded-xl p-3 border border-surface-border flex flex-col justify-between">
                <div className="text-[10px] sm:text-xs text-slate-400 font-medium">Winning Store</div>
                <div className="text-xs sm:text-sm font-bold text-brand uppercase mt-0.5">Croma Online</div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-surface-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-[11px] sm:text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-soft-pulse shrink-0" />
                Scanned 14m ago via Cloud Chromium
              </span>
              <span className="text-slate-400">Alert Dispatched via Resend</span>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Architecture Grid */}
      <section id="how-it-works" className="py-14 sm:py-20 px-4 sm:px-6 border-t border-surface-border bg-surface/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Built for Modern E-Commerce Nuances
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-2 max-w-lg mx-auto">
              Single-page frameworks, aggressive hydration, and dynamic DOM states require more than naive scrapers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-surface-border hover:border-brand/40 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand mb-4">
                <Cpu className="w-5 h-5 text-brand" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white mb-1.5">2-Tier Extraction Engine</h3>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Fast HTTP extraction scans JSON-LD and Next.js hydration stores; Playwright headless Chromium acts as an immediate fallback for anti-bot barriers.
              </p>
            </div>

            <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-surface-border hover:border-brand/40 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand mb-4">
                <Layers className="w-5 h-5 text-brand" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white mb-1.5">Multi-Store Linking</h3>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Track a single product across Croma, Flipkart, and Amazon concurrently. Vechi flags the lowest active vendor in real time.
              </p>
            </div>

            <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-surface-border hover:border-brand/40 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand mb-4">
                <Bell className="w-5 h-5 text-brand" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white mb-1.5">Deduplicated Resend Alerts</h3>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Zero spam: alerts fire at most once every 24 hours per product drop, formatted in clean responsive HTML with one-click purchase links.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-surface-border py-8 px-4 sm:px-6 text-center text-xs text-slate-500">
        <p>&copy; {new Date().getFullYear()} Vechi Price Tracking System. Powered by Next.js, Supabase & Playwright.</p>
      </footer>
    </div>
  );
}
