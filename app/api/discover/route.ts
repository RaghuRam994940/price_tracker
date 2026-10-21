import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { discoverStoreProducts } from "@/lib/search_engine";
import { scrapePrice } from "@/worker/scraper";

export const maxDuration = 60; // Allow sufficient time for parallel store price discovery

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    // Free-tier protection: Check if user has already reached 15 active items
    const { count, error: countErr } = await supabase
      .from("tracked_products")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_active", true);

    if (!countErr && typeof count === "number" && count >= 15) {
      return NextResponse.json(
        {
          error: "Free-Tier Limit Reached: You have reached the maximum quota of 15 actively tracked items. Delete an existing item or deactivate it to track new products.",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { query } = body;

    if (!query || typeof query !== "string" || !query.trim()) {
      return NextResponse.json({ error: "Missing or invalid search query" }, { status: 400 });
    }

    const trimmedQuery = query.trim();
    console.log(`[Discover API] Discovering multi-store deals for: "${trimmedQuery}"`);

    // 1. Search candidate products across Croma, Amazon, and Flipkart
    const candidates = await discoverStoreProducts(trimmedQuery);

    if (candidates.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No product links found on Croma, Amazon, or Flipkart for this query. Please provide a more specific model name or enter a direct URL.",
      });
    }

    // 2. Concurrently scrape live prices for each discovered retailer link
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
          console.warn(`[Discover Scrape Warning] ${candidate.platform} (${candidate.url}):`, (err as Error).message);
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

    // 3. Identify lowest price
    const validPrices = storeResults.filter((s) => s.price !== null && s.price > 0);
    let lowestPrice: number | null = null;
    let lowestPlatform: string | null = null;
    let lowestUrl: string | null = null;

    if (validPrices.length > 0) {
      validPrices.sort((a, b) => a.price! - b.price!);
      lowestPrice = validPrices[0].price;
      lowestPlatform = validPrices[0].platform;
      lowestUrl = validPrices[0].url;
    } else if (storeResults.length > 0) {
      lowestPlatform = storeResults[0].platform;
      lowestUrl = storeResults[0].url;
    }

    // 4. Calculate suggested target threshold (5% discount, rounded to nearest ₹100)
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
    console.error("[Discover API Error]:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
