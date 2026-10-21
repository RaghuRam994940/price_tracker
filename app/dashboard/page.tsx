"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Tag,
  Plus,
  RefreshCw,
  ExternalLink,
  Trash2,
  TrendingDown,
  TrendingUp,
  Clock,
  Shield,
  LogOut,
  Sparkles,
  AlertCircle,
  X,
  CheckCircle2,
  Store,
  Layers,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AddProductModal from "@/components/AddProductModal";

interface ProductLink {
  id: string;
  product_id: string;
  platform: "croma" | "amazon" | "flipkart" | "other";
  url: string;
  is_primary: boolean;
  last_price: number | null;
  last_checked_at: string | null;
}

interface TrackedProduct {
  id: string;
  user_id: string;
  user_email: string;
  title: string;
  target_price: number;
  current_price?: number | null;
  lowest_platform?: string | null;
  lowest_url?: string | null;
  created_at: string;
  updated_at: string;
  product_links: ProductLink[];
}

function formatINR(val: number | null | undefined): string {
  if (val === null || val === undefined) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(val);
}

function formatRelativeTime(timestamp: string | null | undefined): string {
  if (!timestamp) return "Never";
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${diffDay}d ago`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [products, setProducts] = useState<TrackedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch Products
  const loadProducts = useCallback(async () => {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push("/login");
        return;
      }

      setUserEmail(user.email ?? "User");
      setUserId(user.id);

      const { data, error } = await supabase
        .from("tracked_products")
        .select(`
          id,
          user_id,
          user_email,
          title,
          target_price,
          current_price,
          lowest_platform,
          lowest_url,
          created_at,
          updated_at,
          product_links (
            id,
            product_id,
            platform,
            url,
            is_primary,
            last_price,
            last_checked_at
          )
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading products:", error);
      } else {
        setProducts((data as unknown as TrackedProduct[]) || []);
      }
    } catch (err) {
      console.error("Dashboard error:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase, router]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Sign out handler
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // On-Demand Price Check
  const handleCheckNow = async (productId: string) => {
    try {
      setCheckingId(productId);
      const res = await fetch("/api/check-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.links) {
          setProducts((prev) =>
            prev.map((p) =>
              p.id === productId
                ? {
                    ...p,
                    product_links: p.product_links.map((link) => {
                      const updated = data.links.find(
                        (l: ProductLink) => l.id === link.id
                      );
                      return updated ? { ...link, ...updated } : link;
                    }),
                  }
                : p
            )
          );
        }
      }
    } catch (err) {
      console.error("Failed to check price:", err);
    } finally {
      setCheckingId(null);
    }
  };

  // Delete Product
  const handleDeleteProduct = async (productId: string) => {
    if (!window.confirm("Are you sure you want to stop tracking this item?")) return;

    try {
      const { error } = await supabase
        .from("tracked_products")
        .delete()
        .eq("id", productId);

      if (error) {
        alert(`Failed to delete: ${error.message}`);
      } else {
        setProducts((prev) => prev.filter((p) => p.id !== productId));
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  };


  // Helper calculations for metrics
  const totalTracked = products.length;
  let activeDropsCount = 0;
  let totalSavings = 0;

  products.forEach((prod) => {
    const validPrices = prod.product_links
      .map((l) => l.last_price)
      .filter((p): p is number => p !== null && p > 0);

    if (validPrices.length > 0) {
      const minPrice = Math.min(...validPrices);
      if (minPrice <= prod.target_price) {
        activeDropsCount++;
        totalSavings += prod.target_price - minPrice;
      }
    }
  });

  const filteredProducts = products.filter((p) =>
    p.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background text-slate-100 flex flex-col">
      {/* Top Navigation */}
      <header className="border-b border-surface-border sticky top-0 z-40 bg-background/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-surface-secondary border border-surface-border flex items-center justify-center text-brand group-hover:border-brand/40 shadow-glow">
                <Tag className="w-4 h-4 text-brand" />
              </div>
              <span className="text-xl font-black tracking-tight text-white">VECHI</span>
            </Link>
            <span className="hidden sm:inline-block text-xs uppercase px-2.5 py-0.5 rounded-full bg-brand/10 border border-brand/20 text-brand font-semibold">
              Live Console
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 bg-surface-secondary px-3 py-1.5 rounded-lg border border-surface-border">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>{userEmail}</span>
            </div>

            <button
              onClick={handleSignOut}
              className="p-2 rounded-lg bg-surface-secondary hover:bg-surface-border text-slate-400 hover:text-rose-400 transition-colors border border-surface-border"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full space-y-8">
        {/* Metric Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-panel p-5 rounded-2xl border border-surface-border">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Tracked Products</span>
              <Layers className="w-4 h-4 text-brand" />
            </div>
            <div className="text-2xl font-black text-white mt-2">{totalTracked}</div>
            <div className="text-[11px] text-slate-500 mt-1">Multi-store items active</div>
          </div>

          <div className="glass-panel p-5 rounded-2xl border border-surface-border">
            <div className="flex items-center justify-between text-xs text-emerald-400 font-medium">
              <span>Target Drops Met</span>
              <TrendingDown className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400 mt-2">
              {activeDropsCount}
            </div>
            <div className="text-[11px] text-emerald-500/80 mt-1">Items at or below budget</div>
          </div>

          <div className="glass-panel p-5 rounded-2xl border border-surface-border">
            <div className="flex items-center justify-between text-xs text-brand font-medium">
              <span>Potential Savings</span>
              <Sparkles className="w-4 h-4 text-brand" />
            </div>
            <div className="text-2xl font-black text-brand mt-2">
              {formatINR(totalSavings)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Calculated from threshold</div>
          </div>

          <div className="glass-panel p-5 rounded-2xl border border-surface-border">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Automation Engine</span>
              <Clock className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-base font-bold text-slate-200 mt-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-soft-pulse" />
              <span>Cron (Every 4h)</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Playwright + Resend</div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search your tracked products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-secondary border border-surface-border text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:border-brand/50 transition-colors"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-background font-bold text-sm transition-all duration-200 shadow-glow flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Track New Product</span>
            </button>
          </div>
        </div>

        {/* Products List / Grid */}
        {loading ? (
          <div className="py-24 text-center">
            <div className="w-8 h-8 border-2 border-brand/30 border-t-brand rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-slate-400">Loading your price alerts...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-20 px-6 text-center glass-panel rounded-2xl border border-surface-border max-w-xl mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-surface-secondary border border-surface-border flex items-center justify-center text-brand mx-auto mb-4">
              <Store className="w-6 h-6 text-brand" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">No tracked products yet</h3>
            <p className="text-slate-400 text-xs max-w-md mx-auto mb-6">
              Paste a product link from Croma, Amazon, or Flipkart to begin autonomous price monitoring.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-background text-xs font-bold transition-all shadow-glow"
            >
              Add First Product
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredProducts.map((prod) => {
              // Determine lowest price and winning link
              let lowestPrice = prod.current_price ?? null;
              let winningLink = prod.product_links.find((l) => l.url === prod.lowest_url) || null;

              if (lowestPrice === null) {
                const validPrices = prod.product_links
                  .map((l) => l.last_price)
                  .filter((p): p is number => p !== null && p > 0);
                if (validPrices.length > 0) {
                  lowestPrice = Math.min(...validPrices);
                  winningLink = prod.product_links.find((l) => l.last_price === lowestPrice) || prod.product_links[0];
                }
              }

              const isTargetMet = lowestPrice !== null && lowestPrice <= prod.target_price;
              const savings = isTargetMet && lowestPrice !== null ? prod.target_price - lowestPrice : 0;
              const savingsPercent = isTargetMet && lowestPrice !== null && prod.target_price > 0 
                ? Math.round((savings / prod.target_price) * 100) 
                : 0;
              const isChecking = checkingId === prod.id;

              // Latest check timestamp across links
              const latestChecked = prod.product_links
                .map((l) => l.last_checked_at)
                .filter(Boolean)
                .sort()
                .reverse()[0];

              return (
                <div
                  key={prod.id}
                  className="glass-panel p-6 rounded-2xl border border-surface-border hover:border-slate-700 transition-all flex flex-col gap-5 shadow-card"
                >
                  {/* Card Header: Title & Drop Badge */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="text-lg font-bold text-white tracking-tight truncate">
                          {prod.title}
                        </h3>
                        {winningLink && (
                          <span className="px-2.5 py-0.5 rounded-full bg-brand/10 border border-brand/20 text-brand text-[11px] font-bold uppercase tracking-wider">
                            Best on {winningLink.platform}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>Last scanned: {formatRelativeTime(latestChecked)}</span>
                        <span>•</span>
                        <span>Target: <strong className="text-slate-300">{formatINR(prod.target_price)}</strong></span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div>
                      {isTargetMet ? (
                        <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-extrabold flex items-center gap-1.5 shadow-glow-emerald">
                          <TrendingDown className="w-4 h-4" />
                          <span>Save {formatINR(savings)} ({savingsPercent}%)</span>
                        </span>
                      ) : lowestPrice !== null ? (
                        <span className="px-3 py-1 rounded-full bg-surface-secondary border border-surface-border text-slate-400 text-xs font-semibold flex items-center gap-1.5">
                          <TrendingUp className="w-4 h-4 text-amber-400" />
                          <span>{formatINR(lowestPrice - prod.target_price)} above budget</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-surface-secondary text-slate-400 text-xs font-semibold">
                          Pending Scan
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Main Price & Action Showcase Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-background/60 border border-surface-border items-center">
                    <div>
                      <div className="text-[11px] text-slate-400 uppercase font-semibold tracking-wider">
                        Current Lowest Price
                      </div>
                      <div className="text-3xl font-black mt-1">
                        {lowestPrice !== null ? (
                          <span className={isTargetMet ? "text-emerald-400" : "text-white"}>
                            {formatINR(lowestPrice)}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-base font-normal">Pending initial scan</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] text-slate-400 uppercase font-semibold tracking-wider">
                        Target Budget
                      </div>
                      <div className="text-xl font-bold text-slate-300 mt-1 line-through decoration-slate-500">
                        {formatINR(prod.target_price)}
                      </div>
                    </div>

                    {/* CTA Buttons */}
                    <div className="flex items-center sm:justify-end gap-2.5">
                      {winningLink && (
                        <a
                          href={winningLink.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-background font-bold text-xs uppercase tracking-wider shadow-glow transition-all flex items-center justify-center gap-1.5"
                        >
                          <span>Visit {winningLink.platform}</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}

                      <button
                        onClick={() => handleCheckNow(prod.id)}
                        disabled={isChecking}
                        className="px-3 py-2.5 rounded-xl bg-surface-secondary hover:bg-surface-border text-slate-300 hover:text-white text-xs font-semibold border border-surface-border transition-colors flex items-center gap-1.5 disabled:opacity-60"
                        title="Check Live Price Now"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${isChecking ? "animate-spin text-brand" : ""}`}
                        />
                        <span className="hidden sm:inline">{isChecking ? "Scanning..." : "Check"}</span>
                      </button>

                      <button
                        onClick={() => handleDeleteProduct(prod.id)}
                        className="p-2.5 rounded-xl bg-surface-secondary hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 border border-surface-border hover:border-rose-500/30 transition-colors"
                        title="Delete Product"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Multi-Store Comparison Breakdown Chips */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                      Store Link Comparison ({prod.product_links.length} store{prod.product_links.length === 1 ? "" : "s"})
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {prod.product_links.map((link) => {
                        const isWinningStore = link.last_price !== null && link.last_price === lowestPrice;
                        return (
                          <a
                            key={link.id}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors group ${
                              isWinningStore
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                                : "bg-surface-secondary hover:bg-surface-hover border-surface-border text-slate-300"
                            }`}
                          >
                            <span className="uppercase font-bold text-[10px] tracking-wider text-brand">
                              {link.platform}
                            </span>
                            <span className={isWinningStore ? "font-bold text-emerald-400" : "text-slate-400"}>
                              {link.last_price ? formatINR(link.last_price) : "Scan"}
                            </span>
                            {isWinningStore && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold uppercase">
                                Lowest
                              </span>
                            )}
                            <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-brand" />
                          </a>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Add Product Modal */}
      <AddProductModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onProductCreated={(newProd) => setProducts((prev) => [newProd, ...prev])}
      />
    </div>
  );
}
