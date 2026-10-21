import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { scrapePrice, SupportedPlatform } from "@/worker/scraper";

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
    const { productId } = body;

    if (!productId) {
      return NextResponse.json({ error: "Missing productId" }, { status: 400 });
    }

    // 1. Fetch product verifying ownership via RLS
    const { data: product, error: prodError } = await supabase
      .from("tracked_products")
      .select("id, title, target_price")
      .eq("id", productId)
      .single();

    if (prodError || !product) {
      return NextResponse.json({ error: "Product not found or unauthorized" }, { status: 404 });
    }

    // 2. Fetch associated links
    const { data: links, error: linksError } = await supabase
      .from("product_links")
      .select("id, platform, url, last_price, last_checked_at")
      .eq("product_id", productId);

    if (linksError || !links || links.length === 0) {
      return NextResponse.json({ error: "No store links configured for this product" }, { status: 400 });
    }

    const updatedLinks = [];
    let lowestPrice: number | null = null;

    // 3. Re-scrape each link
    for (const link of links) {
      try {
        const { price } = await scrapePrice(link.url, link.platform as SupportedPlatform);
        if (price !== null) {
          const nowIso = new Date().toISOString();
          await supabase
            .from("product_links")
            .update({
              last_price: price,
              last_checked_at: nowIso,
            })
            .eq("id", link.id);

          updatedLinks.push({
            ...link,
            last_price: price,
            last_checked_at: nowIso,
          });

          if (lowestPrice === null || price < lowestPrice) {
            lowestPrice = price;
          }
        } else {
          updatedLinks.push(link);
        }
      } catch (err) {
        console.error(`Error scraping link ${link.id}:`, err);
        updatedLinks.push(link);
      }
    }

    return NextResponse.json({
      success: true,
      productId,
      lowestPrice,
      targetPrice: product.target_price,
      isTargetMet: lowestPrice !== null && lowestPrice <= product.target_price,
      links: updatedLinks,
    });
  } catch (error) {
    console.error("Manual check error:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
