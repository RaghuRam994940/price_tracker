import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { scrapePrice, detectPlatform, SupportedPlatform } from "@/worker/scraper";

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
    const { title, target_price, primary_url, secondary_urls = [] } = body;

    const targetPriceNum = parseFloat(target_price);
    if (!title || !primary_url || isNaN(targetPriceNum) || targetPriceNum <= 0) {
      return NextResponse.json(
        { error: "Invalid title, target price, or primary URL." },
        { status: 400 }
      );
    }

    // 1. Gather all URLs to scrape
    const rawLinks = [
      { url: primary_url.trim(), is_primary: true },
      ...secondary_urls
        .filter((u: string) => typeof u === "string" && u.trim().length > 0)
        .map((u: string) => ({ url: u.trim(), is_primary: false })),
    ];

    // 2. Synchronous Scrape: fetch live initial prices immediately
    const scrapedLinks = [];
    let lowestPrice: number | null = null;
    let lowestPlatform: string | null = null;
    let lowestUrl: string | null = null;

    for (const item of rawLinks) {
      const platform = detectPlatform(item.url);
      let price: number | null = null;
      try {
        const res = await scrapePrice(item.url, platform);
        price = res.price;
      } catch (err) {
        console.warn(`Initial scrape failed for ${item.url}:`, (err as Error).message);
      }

      scrapedLinks.push({
        platform,
        url: item.url,
        is_primary: item.is_primary,
        last_price: price,
        last_checked_at: price !== null ? new Date().toISOString() : null,
      });

      if (price !== null && (lowestPrice === null || price < lowestPrice)) {
        lowestPrice = price;
        lowestPlatform = platform;
        lowestUrl = item.url;
      }
    }

    // 3. Insert tracked product record
    const { data: newProd, error: prodErr } = await supabase
      .from("tracked_products")
      .insert({
        user_id: user.id,
        user_email: user.email!,
        title: title.trim(),
        target_price: targetPriceNum,
        current_price: lowestPrice,
        lowest_platform: lowestPlatform,
        lowest_url: lowestUrl,
      })
      .select()
      .single();

    if (prodErr || !newProd) {
      throw new Error(prodErr?.message || "Failed to create tracked product");
    }

    // 4. Insert product links with scraped prices
    const linksToInsert = scrapedLinks.map((l) => ({
      ...l,
      product_id: newProd.id,
    }));

    const { data: createdLinks, error: linksErr } = await supabase
      .from("product_links")
      .insert(linksToInsert)
      .select();

    if (linksErr) {
      throw new Error(linksErr.message);
    }

    return NextResponse.json({
      success: true,
      product: {
        ...newProd,
        current_price: lowestPrice,
        lowest_platform: lowestPlatform,
        lowest_url: lowestUrl,
        product_links: createdLinks,
      },
    });
  } catch (error) {
    console.error("Create product error:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
