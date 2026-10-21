import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { discoverStoreProducts } from "@/lib/search_engine";
import { scrapePrice } from "@/worker/scraper";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { query } = body;

    if (!query || typeof query !== "string" || !query.trim()) {
      return NextResponse.json({ error: "Missing or invalid search query" }, { status: 400 });
    }

    const trimmedQuery = query.trim();
    console.log(`[Search API] Searching multi-store candidates for: "${trimmedQuery}"`);

    // 1. Search across Croma, Amazon, Flipkart (with double caching)
    const candidates = await discoverStoreProducts(trimmedQuery);

    if (candidates.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No product links found on Croma, Amazon, or Flipkart for this query. Try a more specific model name or paste a direct URL.",
      });
    }

    // 2. Concurrently scrape live prices for each discovered store link
    const storeResults = await Promise.all(
      candidates.map(async (candidate) => {
        try {
          const { price } = await scrapePrice(candidate.url, candidate.platform);
          return {
            platform: candidate.platform,
            url: candidate.url,
            title: candidate.title,
            snippet: candidate.snippet,
            price,
          };
        } catch (err) {
          console.warn(`[Search Scrape Error] ${candidate.url}:`, (err as Error).message);
          return {
            platform: candidate.platform,
            url: candidate.url,
            title: candidate.title,
            snippet: candidate.snippet,
            price: null,
          };
        }
      })
    );

    // Filter stores that returned valid prices
    const validStores = storeResults.filter((s) => s.price !== null && s.price > 0);

    let lowestPrice: number | null = null;
    let lowestPlatform: string | null = null;
    let lowestUrl: string | null = null;

    if (validStores.length > 0) {
      // Sort ascending by price
      validStores.sort((a, b) => a.price! - b.price!);
      lowestPrice = validStores[0].price;
      lowestPlatform = validStores[0].platform;
      lowestUrl = validStores[0].url;
    } else if (storeResults.length > 0) {
      // Fallback if live price scrape blocked in fast path
      lowestPlatform = storeResults[0].platform;
      lowestUrl = storeResults[0].url;
    }

    // Suggested target threshold: 5% below lowest price, rounded to nearest 100
    const suggestedTargetPrice = lowestPrice
      ? Math.max(1, Math.round((lowestPrice * 0.95) / 100) * 100)
      : null;

    const formattedStores = storeResults.map((s) => ({
      ...s,
      isLowest: lowestPrice !== null && s.price === lowestPrice,
    }));

    return NextResponse.json({
      success: true,
      query: trimmedQuery,
      lowestPrice,
      lowestPlatform,
      lowestUrl,
      suggestedTargetPrice,
      stores: formattedStores,
    });
  } catch (err) {
    console.error("[Search Product API Error]:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
