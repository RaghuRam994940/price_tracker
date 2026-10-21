import * as cheerio from "cheerio";
import { SupportedPlatform, detectPlatform } from "@/lib/platforms";
import { createAdminClient } from "@/lib/supabase/admin";

export interface SearchCandidate {
  title: string;
  url: string;
  platform: SupportedPlatform;
  snippet?: string;
}

const DESKTOP_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "en-IN,en;q=0.9,hi;q=0.8",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

// In-memory cache to prevent duplicate queries within the same Node runtime (24h TTL)
interface CacheEntry {
  results: SearchCandidate[];
  expiresAt: number;
}
const memorySearchCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Filter and validate whether a URL points to a specific product detail page
 */
export function isProductUrl(url: string, platform: SupportedPlatform): boolean {
  const lower = url.toLowerCase();
  switch (platform) {
    case "croma":
      return lower.includes("/p/") && !lower.includes("/c/") && !lower.includes("/search");
    case "amazon":
      return (lower.includes("/dp/") || lower.includes("/gp/product/")) && !lower.includes("/s?");
    case "flipkart":
      return (lower.includes("/p/") || lower.includes("/itm")) && !lower.includes("/search?");
    default:
      return true;
  }
}

/**
 * Clean tracking parameters and affiliate codes from store URLs
 */
export function cleanProductUrl(url: string, platform: SupportedPlatform): string {
  try {
    const parsed = new URL(url);
    if (platform === "amazon") {
      // Keep only host + pathname up to the ASIN
      const match = parsed.pathname.match(/(.*\/dp\/[A-Z0-9]{10}|.*\/gp\/product\/[A-Z0-9]{10})/i);
      if (match) {
        return `https://www.amazon.in${match[1]}`;
      }
      return `${parsed.origin}${parsed.pathname}`;
    }
    if (platform === "flipkart") {
      // Flipkart keeps ?pid=XXXXX for product variant identification
      const pid = parsed.searchParams.get("pid");
      return pid ? `${parsed.origin}${parsed.pathname}?pid=${pid}` : `${parsed.origin}${parsed.pathname}`;
    }
    if (platform === "croma") {
      return `${parsed.origin}${parsed.pathname}`;
    }
    return url.split("?")[0];
  } catch {
    return url;
  }
}

/**
 * Check cache: First in-memory, then Supabase `search_cache` table
 */
async function getCachedSearch(normalizedKey: string): Promise<SearchCandidate[] | null> {
  // 1. Check in-memory map
  const mem = memorySearchCache.get(normalizedKey);
  if (mem && mem.expiresAt > Date.now()) {
    return mem.results;
  }

  // 2. Check Supabase search_cache table
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("search_cache")
      .select("results, expires_at")
      .eq("query_key", normalizedKey)
      .single();

    if (!error && data) {
      const expiresAt = new Date(data.expires_at).getTime();
      if (expiresAt > Date.now() && Array.isArray(data.results)) {
        // Hydrate memory cache
        memorySearchCache.set(normalizedKey, {
          results: data.results as SearchCandidate[],
          expiresAt,
        });
        return data.results as SearchCandidate[];
      }
    }
  } catch {}

  return null;
}

/**
 * Persist search results in both memory cache and Supabase search_cache table
 */
async function setCachedSearch(normalizedKey: string, results: SearchCandidate[]): Promise<void> {
  const expiresAtMs = Date.now() + CACHE_TTL_MS;
  const expiresAtIso = new Date(expiresAtMs).toISOString();

  // Store in memory
  memorySearchCache.set(normalizedKey, {
    results,
    expiresAt: expiresAtMs,
  });

  // Store in Supabase search_cache
  try {
    const supabase = createAdminClient();
    await supabase.from("search_cache").upsert({
      query_key: normalizedKey,
      results,
      expires_at: expiresAtIso,
    });
  } catch {}
}

/**
 * Tier 1: Query Google Custom Search JSON API
 */
async function searchGoogleCustomSearch(query: string): Promise<SearchCandidate[]> {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_CX || process.env.GOOGLE_SEARCH_ENGINE_ID;

  if (!apiKey || !cx) {
    return [];
  }

  const scopedQuery = `(site:croma.com OR site:amazon.in OR site:flipkart.com) ${query}`;
  const apiUrl = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(
    apiKey
  )}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(scopedQuery)}&num=10`;

  try {
    const res = await fetch(apiUrl, { next: { revalidate: 3600 } });
    if (!res.ok) {
      console.warn(`[Google Search API] Status ${res.status}: Quota limit reached or invalid credentials.`);
      return [];
    }

    const data = await res.json();
    if (!data.items || !Array.isArray(data.items)) {
      return [];
    }

    const results: SearchCandidate[] = [];
    for (const item of data.items) {
      const link = item.link;
      const platform = detectPlatform(link);
      if (platform !== "other" && isProductUrl(link, platform)) {
        results.push({
          title: item.title,
          url: cleanProductUrl(link, platform),
          platform,
          snippet: item.snippet,
        });
      }
    }

    return results;
  } catch (err) {
    console.error("[Google Search API Error]:", (err as Error).message);
    return [];
  }
}

/**
 * Tier 2: Resilient Fallback - Direct Store Scraping & DuckDuckGo HTML
 */
async function searchStoreFallback(query: string): Promise<SearchCandidate[]> {
  const results: SearchCandidate[] = [];
  const encodedQuery = encodeURIComponent(query);

  // 1. Croma via DuckDuckGo HTML site:croma.com/p/
  try {
    const ddgCromaUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(
      `site:croma.com/p/ ${query}`
    )}`;
    const res = await fetch(ddgCromaUrl, { headers: DESKTOP_HEADERS });
    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);
      let foundUrl: string | null = null;
      $(".result__url").each((_, el) => {
        if (foundUrl) return;
        const raw = $(el).text().trim();
        if (raw.includes("croma.com") && raw.includes("/p/")) {
          foundUrl = raw.startsWith("http") ? raw : `https://${raw}`;
        }
      });
      if (foundUrl) {
        results.push({
          title: `${query} on Croma`,
          url: cleanProductUrl(foundUrl, "croma"),
          platform: "croma",
        });
      }
    }
  } catch {}

  // 2. Amazon Search
  try {
    const amazonSearchUrl = `https://www.amazon.in/s?k=${encodedQuery}`;
    const res = await fetch(amazonSearchUrl, { headers: DESKTOP_HEADERS });
    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);
      const link = $('a[href*="/dp/"]').first().attr("href");
      if (link) {
        const fullUrl = link.startsWith("http") ? link : `https://www.amazon.in${link}`;
        results.push({
          title: `${query} on Amazon`,
          url: cleanProductUrl(fullUrl, "amazon"),
          platform: "amazon",
        });
      }
    }
  } catch {}

  // 3. Flipkart Search
  try {
    const flipkartSearchUrl = `https://www.flipkart.com/search?q=${encodedQuery}`;
    const res = await fetch(flipkartSearchUrl, { headers: DESKTOP_HEADERS });
    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);
      const link = $('a[href*="/p/"]').first().attr("href");
      if (link) {
        const fullUrl = link.startsWith("http") ? link : `https://www.flipkart.com${link}`;
        results.push({
          title: `${query} on Flipkart`,
          url: cleanProductUrl(fullUrl, "flipkart"),
          platform: "flipkart",
        });
      }
    }
  } catch {}

  return results;
}

/**
 * Filter candidates: Retain the single best candidate per retailer
 */
export function filterBestCandidates(
  candidates: SearchCandidate[]
): Record<SupportedPlatform, SearchCandidate | null> {
  const best: Record<SupportedPlatform, SearchCandidate | null> = {
    croma: null,
    amazon: null,
    flipkart: null,
    other: null,
  };

  for (const item of candidates) {
    if (item.platform in best && best[item.platform] === null) {
      best[item.platform] = item;
    }
  }

  return best;
}

/**
 * Orchestrator: Finds the top store candidates for a given product model/name
 * Leverages double caching (RAM + DB) to protect Google Custom Search 100/day free limit.
 */
export async function discoverStoreProducts(query: string): Promise<SearchCandidate[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const cacheKey = trimmed.toLowerCase();

  // 1. Check Cache
  const cached = await getCachedSearch(cacheKey);
  if (cached && cached.length > 0) {
    console.log(`[Search Engine] Cache HIT for "${trimmed}" (${cached.length} stores)`);
    return cached;
  }

  console.log(`[Search Engine] Cache MISS. Querying providers for "${trimmed}"`);

  // 2. Try Google Custom Search API
  let candidates = await searchGoogleCustomSearch(trimmed);

  // 3. Resilient Fallback if Google API is empty or quota is exhausted
  if (candidates.length === 0) {
    console.log(`[Search Engine] Google API returned 0 results. Triggering direct store fallback...`);
    candidates = await searchStoreFallback(trimmed);
  }

  // 4. Filter top 1 candidate per store
  const bestPerStore = filterBestCandidates(candidates);
  const selected: SearchCandidate[] = [];
  if (bestPerStore.croma) selected.push(bestPerStore.croma);
  if (bestPerStore.amazon) selected.push(bestPerStore.amazon);
  if (bestPerStore.flipkart) selected.push(bestPerStore.flipkart);

  // 5. Store in Cache if candidates were discovered
  if (selected.length > 0) {
    await setCachedSearch(cacheKey, selected);
  }

  return selected;
}
