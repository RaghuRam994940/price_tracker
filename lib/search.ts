import * as cheerio from "cheerio";
import { SupportedPlatform, detectPlatform } from "@/lib/platforms";

export interface SearchProductResult {
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

/**
 * Filter and validate whether a URL points to a specific product detail page
 */
function isProductUrl(url: string, platform: SupportedPlatform): boolean {
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
 * Tier 1: Query Google Custom Search JSON API
 */
async function searchGoogleCustomSearch(query: string): Promise<SearchProductResult[]> {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_CX || process.env.GOOGLE_SEARCH_ENGINE_ID;

  if (!apiKey || !cx) {
    return [];
  }

  // Target query constrained to the primary Indian e-commerce domains
  const scopedQuery = `(site:croma.com OR site:amazon.in OR site:flipkart.com) ${query}`;
  const apiUrl = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(
    apiKey
  )}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(scopedQuery)}&num=10`;

  try {
    const res = await fetch(apiUrl, { next: { revalidate: 300 } });
    if (!res.ok) {
      console.warn(`[Google Search API Error] Status: ${res.status}`);
      return [];
    }

    const data = await res.json();
    if (!data.items || !Array.isArray(data.items)) {
      return [];
    }

    const results: SearchProductResult[] = [];
    for (const item of data.items) {
      const link = item.link;
      const platform = detectPlatform(link);
      if (platform !== "other" && isProductUrl(link, platform)) {
        results.push({
          title: item.title,
          url: link,
          platform,
          snippet: item.snippet,
        });
      }
    }

    return results;
  } catch (err) {
    console.error("[Google Search API Exception]:", (err as Error).message);
    return [];
  }
}

/**
 * Tier 2: Resilient Fallback - Search directly on store sites if Google API key is absent/exhausted
 */
async function searchStoreFallback(query: string): Promise<SearchProductResult[]> {
  const results: SearchProductResult[] = [];
  const encodedQuery = encodeURIComponent(query);

  // 1. Croma Search (via DuckDuckGo HTML fallback)
  try {
    const ddgCromaUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(
      `site:croma.com/p/ ${query}`
    )}`;
    const res = await fetch(ddgCromaUrl, { headers: DESKTOP_HEADERS, redirect: "follow" });
    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);
      let foundCromaUrl: string | null = null;
      $(".result__url").each((_, el) => {
        if (foundCromaUrl) return;
        const raw = $(el).text().trim();
        if (raw.includes("croma.com") && raw.includes("/p/")) {
          foundCromaUrl = raw.startsWith("http") ? raw : `https://${raw}`;
        }
      });
      if (foundCromaUrl) {
        results.push({
          title: `${query} on Croma`,
          url: foundCromaUrl,
          platform: "croma",
        });
      }
    }
  } catch {}

  // 2. Amazon Search
  try {
    const amazonSearchUrl = `https://www.amazon.in/s?k=${encodedQuery}`;
    const res = await fetch(amazonSearchUrl, { headers: DESKTOP_HEADERS, redirect: "follow" });
    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);
      const link = $('a[href*="/dp/"]').first().attr("href");
      if (link) {
        const fullUrl = link.startsWith("http") ? link : `https://www.amazon.in${link}`;
        // Clean affiliate or tracking junk
        const cleanUrl = fullUrl.split("?")[0];
        results.push({
          title: `${query} on Amazon`,
          url: cleanUrl,
          platform: "amazon",
        });
      }
    }
  } catch {}

  // 3. Flipkart Search
  try {
    const flipkartSearchUrl = `https://www.flipkart.com/search?q=${encodedQuery}`;
    const res = await fetch(flipkartSearchUrl, { headers: DESKTOP_HEADERS, redirect: "follow" });
    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);
      const link = $('a[href*="/p/"]').first().attr("href");
      if (link) {
        const fullUrl = link.startsWith("http") ? link : `https://www.flipkart.com${link}`;
        const cleanUrl = fullUrl.split("&")[0];
        results.push({
          title: `${query} on Flipkart`,
          url: cleanUrl,
          platform: "flipkart",
        });
      }
    }
  } catch {}

  return results;
}

/**
 * Filter candidates to pick the top 1 most relevant product URL per platform
 */
export function filterBestCandidatesPerStore(
  candidates: SearchProductResult[]
): Record<SupportedPlatform, SearchProductResult | null> {
  const best: Record<SupportedPlatform, SearchProductResult | null> = {
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
 * Main Search Orchestrator: queries Google Custom Search API with automatic Store Search fallback
 */
export async function searchMultiStoreProducts(query: string): Promise<SearchProductResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // Try Google Custom Search API first
  let candidates = await searchGoogleCustomSearch(trimmed);

  // If no candidates from Google API (keys absent, quota reached, or 0 results), use fallback
  if (candidates.length === 0) {
    candidates = await searchStoreFallback(trimmed);
  }

  const bestPerStore = filterBestCandidatesPerStore(candidates);
  const selected: SearchProductResult[] = [];

  if (bestPerStore.croma) selected.push(bestPerStore.croma);
  if (bestPerStore.amazon) selected.push(bestPerStore.amazon);
  if (bestPerStore.flipkart) selected.push(bestPerStore.flipkart);

  return selected;
}
