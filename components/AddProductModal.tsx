"use client";

import { useState } from "react";
import {
  X,
  Search,
  Link as LinkIcon,
  Sparkles,
  AlertCircle,
  ExternalLink,
  Plus,
  TrendingDown,
  Check,
  CheckCircle2,
} from "lucide-react";
import { detectPlatform, SupportedPlatform } from "@/lib/platforms";

interface ProductLink {
  id: string;
  product_id: string;
  platform: SupportedPlatform;
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

interface StoreSearchResult {
  platform: SupportedPlatform;
  url: string;
  title: string;
  price: number | null;
  isLowest: boolean;
  snippet?: string;
}

interface SearchDiscoveryData {
  query: string;
  lowestPrice: number | null;
  lowestPlatform: string | null;
  lowestUrl: string | null;
  suggestedTargetPrice: number | null;
  stores: StoreSearchResult[];
}

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductCreated: (product: TrackedProduct) => void;
}

function formatINR(val: number | null | undefined): string {
  if (val === null || val === undefined) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(val);
}

export default function AddProductModal({
  isOpen,
  onClose,
  onProductCreated,
}: AddProductModalProps) {
  const [activeTab, setActiveTab] = useState<"search" | "direct">("search");

  // --- Auto-Search State ---
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [discovery, setDiscovery] = useState<SearchDiscoveryData | null>(null);
  const [autoTargetPrice, setAutoTargetPrice] = useState<string>("");
  const [confirmingAuto, setConfirmingAuto] = useState(false);

  // --- Direct URL Form State ---
  const [directTitle, setDirectTitle] = useState("");
  const [directTargetPrice, setDirectTargetPrice] = useState("");
  const [directPrimaryUrl, setDirectPrimaryUrl] = useState("");
  const [secondaryLinks, setSecondaryLinks] = useState<{ url: string; platform: SupportedPlatform }[]>([]);
  const [directSubmitting, setDirectSubmitting] = useState(false);
  const [directError, setDirectError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Handler: Execute Multi-Store Search
  const handleExecuteSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      setSearching(true);
      setSearchError(null);
      setDiscovery(null);

      const res = await fetch("/api/search-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "No matching products found across stores.");
      }

      setDiscovery(data);
      if (data.suggestedTargetPrice) {
        setAutoTargetPrice(String(data.suggestedTargetPrice));
      } else if (data.lowestPrice) {
        setAutoTargetPrice(String(Math.round(data.lowestPrice * 0.95)));
      }
    } catch (err) {
      setSearchError((err as Error).message);
    } finally {
      setSearching(false);
    }
  };

  // Handler: Confirm and Track Discovered Search Deal
  const handleConfirmAutoDeal = async () => {
    if (!discovery || !discovery.lowestUrl) return;
    const targetPriceNum = parseFloat(autoTargetPrice);

    if (isNaN(targetPriceNum) || targetPriceNum <= 0) {
      setSearchError("Please enter a valid target budget price.");
      return;
    }

    try {
      setConfirmingAuto(true);
      setSearchError(null);

      // Primary URL is the store with the lowest price
      const primaryUrl = discovery.lowestUrl;
      const otherUrls = discovery.stores
        .filter((s) => s.url !== primaryUrl)
        .map((s) => s.url);

      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: discovery.query,
          target_price: targetPriceNum,
          primary_url: primaryUrl,
          secondary_urls: otherUrls,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to start tracking this deal.");
      }

      onProductCreated(data.product);
      handleClose();
    } catch (err) {
      setSearchError((err as Error).message);
    } finally {
      setConfirmingAuto(false);
    }
  };

  // Handler: Direct URL Form Submission
  const handleDirectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetPrice = parseFloat(directTargetPrice);
    if (!directTitle.trim() || isNaN(targetPrice) || targetPrice <= 0) {
      setDirectError("Please enter a valid title and target price.");
      return;
    }

    if (!directPrimaryUrl.trim()) {
      setDirectError("Please provide a valid primary store URL.");
      return;
    }

    try {
      setDirectSubmitting(true);
      setDirectError(null);

      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: directTitle.trim(),
          target_price: targetPrice,
          primary_url: directPrimaryUrl.trim(),
          secondary_urls: secondaryLinks.map((l) => l.url.trim()).filter(Boolean),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to track product.");
      }

      onProductCreated(data.product);
      handleClose();
    } catch (err) {
      setDirectError((err as Error).message);
    } finally {
      setDirectSubmitting(false);
    }
  };

  const handleClose = () => {
    setSearchQuery("");
    setDiscovery(null);
    setSearchError(null);
    setAutoTargetPrice("");
    setDirectTitle("");
    setDirectTargetPrice("");
    setDirectPrimaryUrl("");
    setSecondaryLinks([]);
    setDirectError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="w-full max-w-xl glass-panel rounded-2xl p-6 border border-surface-border shadow-card relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={handleClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-surface-border transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-bold text-white tracking-tight">Track New Product</h2>
        <p className="text-xs text-slate-400 mt-0.5 mb-5">
          Choose automated multi-store discovery by name or paste a direct store URL.
        </p>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface-secondary border border-surface-border mb-6">
          <button
            type="button"
            onClick={() => setActiveTab("search")}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "search"
                ? "bg-brand text-background shadow-glow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Auto-Search by Name</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("direct")}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "direct"
                ? "bg-brand text-background shadow-glow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>Paste Direct URL</span>
          </button>
        </div>

        {/* ================= TAB 1: AUTO-SEARCH ================= */}
        {activeTab === "search" && (
          <div className="space-y-5">
            {searchError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{searchError}</span>
              </div>
            )}

            {!discovery ? (
              <form onSubmit={handleExecuteSearch} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Product Name or Model
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. HP Omen 15 14th Gen or iPhone 15 128GB"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      disabled={searching}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-secondary border border-surface-border text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-brand/50 transition-colors"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    We'll search Croma, Amazon, and Flipkart simultaneously to find the lowest active price.
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2.5 rounded-xl bg-surface-secondary hover:bg-surface-border text-slate-300 text-xs font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={searching || !searchQuery.trim()}
                    className="px-5 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-background font-bold text-xs shadow-glow transition-all disabled:opacity-60 cursor-pointer flex items-center gap-2"
                  >
                    {searching ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-background/20 border-t-background rounded-full animate-spin" />
                        <span>Scanning Croma, Amazon & Flipkart...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-3.5 h-3.5" />
                        <span>Find Lowest Price</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* Step 2: Discovery Results Review & Target Price Setup */
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-surface-secondary/80 border border-surface-border space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-brand uppercase tracking-wider">
                      Discovery Complete
                    </span>
                    <button
                      type="button"
                      onClick={() => setDiscovery(null)}
                      className="text-[11px] text-slate-400 hover:text-brand underline"
                    >
                      Change Search Query
                    </button>
                  </div>

                  <h3 className="text-base font-bold text-white">{discovery.query}</h3>

                  {/* Lowest Price Banner */}
                  {discovery.lowestPrice !== null ? (
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] text-emerald-400 uppercase font-extrabold tracking-wider">
                          Lowest Detected Price
                        </div>
                        <div className="text-2xl font-black text-emerald-400 mt-0.5">
                          {formatINR(discovery.lowestPrice)}
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold uppercase tracking-wider">
                        Found on {discovery.lowestPlatform}
                      </span>
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg bg-surface-secondary text-slate-400 text-xs">
                      Product links detected across stores. Background crawler will verify exact pricing.
                    </div>
                  )}

                  {/* Multi-Store Comparison List */}
                  <div className="space-y-2 pt-1">
                    <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                      Matched Store Listings ({discovery.stores.length})
                    </div>
                    <div className="space-y-1.5">
                      {discovery.stores.map((store, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center justify-between p-2.5 rounded-lg border text-xs ${
                            store.isLowest
                              ? "bg-emerald-500/5 border-emerald-500/30 text-white"
                              : "bg-background/60 border-surface-border text-slate-300"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                            <span className="font-extrabold uppercase text-[10px] tracking-wider text-brand px-1.5 py-0.5 rounded bg-surface-secondary">
                              {store.platform}
                            </span>
                            <span className="truncate text-slate-300">{store.title}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={store.isLowest ? "font-bold text-emerald-400" : "text-slate-400"}>
                              {store.price ? formatINR(store.price) : "Scan in worker"}
                            </span>
                            <a
                              href={store.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-slate-500 hover:text-brand"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Target Price Input */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Your Alert Target Budget (₹)
                    </label>
                    {discovery.suggestedTargetPrice && (
                      <span className="text-[10px] text-emerald-400 font-bold">
                        Suggested: 5% discount
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    placeholder="Enter target threshold price"
                    value={autoTargetPrice}
                    onChange={(e) => setAutoTargetPrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-secondary border border-surface-border text-slate-100 text-sm focus:outline-none focus:border-brand/50 transition-colors"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    You'll receive an instant email via Resend the minute any store drops below this amount.
                  </p>
                </div>

                <div className="pt-3 flex items-center justify-end gap-3 border-t border-surface-border">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2.5 rounded-xl bg-surface-secondary hover:bg-surface-border text-slate-300 text-xs font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmAutoDeal}
                    disabled={confirmingAuto || !autoTargetPrice}
                    className="px-5 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-background font-bold text-xs shadow-glow transition-all disabled:opacity-60 cursor-pointer flex items-center gap-2"
                  >
                    {confirmingAuto ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-background/20 border-t-background rounded-full animate-spin" />
                        <span>Saving Deal...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Start Tracking This Deal</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 2: PASTE DIRECT URL ================= */}
        {activeTab === "direct" && (
          <form onSubmit={handleDirectSubmit} className="space-y-4">
            {directError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{directError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Product Title
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Sony PlayStation 5 Slim Digital"
                value={directTitle}
                onChange={(e) => setDirectTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-secondary border border-surface-border text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-brand/50 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Target Threshold Price (₹)
              </label>
              <input
                type="number"
                required
                min="1"
                step="any"
                placeholder="e.g. 39999"
                value={directTargetPrice}
                onChange={(e) => setDirectTargetPrice(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-secondary border border-surface-border text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-brand/50 transition-colors"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Primary Store URL
                </label>
                {directPrimaryUrl && (
                  <span className="text-[10px] font-bold text-brand uppercase">
                    Detected: {detectPlatform(directPrimaryUrl)}
                  </span>
                )}
              </div>
              <input
                type="url"
                required
                placeholder="https://www.croma.com/... or Amazon / Flipkart"
                value={directPrimaryUrl}
                onChange={(e) => setDirectPrimaryUrl(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-secondary border border-surface-border text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-brand/50 transition-colors"
              />
            </div>

            {/* Additional Store URLs */}
            {secondaryLinks.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-surface-border">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Additional Comparison Links
                </label>
                {secondaryLinks.map((link, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="url"
                      placeholder="Additional store URL (Amazon, Flipkart, etc.)"
                      value={link.url}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSecondaryLinks((prev) =>
                          prev.map((item, i) =>
                            i === idx
                              ? { ...item, url: val, platform: detectPlatform(val) }
                              : item
                          )
                        );
                      }}
                      className="flex-1 px-3 py-2 rounded-lg bg-surface-secondary border border-surface-border text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand/50"
                    />
                    <button
                      type="button"
                      onClick={() => setSecondaryLinks((prev) => prev.filter((_, i) => i !== idx))}
                      className="p-2 text-slate-400 hover:text-rose-400 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => setSecondaryLinks((prev) => [...prev, { url: "", platform: "other" }])}
              className="text-xs text-brand hover:underline font-semibold flex items-center gap-1 pt-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Secondary Store Link</span>
            </button>

            <div className="pt-4 flex items-center justify-end gap-3 border-t border-surface-border">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2.5 rounded-xl bg-surface-secondary hover:bg-surface-border text-slate-300 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={directSubmitting}
                className="px-5 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-background font-bold text-xs shadow-glow transition-all disabled:opacity-60 cursor-pointer flex items-center gap-2"
              >
                {directSubmitting && (
                  <div className="w-3.5 h-3.5 border-2 border-background/20 border-t-background rounded-full animate-spin" />
                )}
                <span>{directSubmitting ? "Scraping Live Price..." : "Start Tracking"}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
