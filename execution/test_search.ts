import "dotenv/config";
import { searchMultiStoreProducts } from "../lib/search";
import { scrapePrice, closeBrowser } from "../worker/scraper";

async function main() {
  const query = process.argv[2] || "HP Omen 15";

  console.log(`\n======================================================`);
  console.log(`[Vechi Search Discovery] Query: "${query}"`);
  console.log(`======================================================`);

  const startTime = Date.now();
  const candidates = await searchMultiStoreProducts(query);

  console.log(`Discovered Candidates (${candidates.length}):`);
  candidates.forEach((c, i) => {
    console.log(` [${i + 1}] Platform: ${c.platform.toUpperCase()}`);
    console.log(`     Title:    ${c.title}`);
    console.log(`     URL:      ${c.url}`);
  });

  if (candidates.length === 0) {
    console.log(`No product candidates discovered.`);
    return;
  }

  console.log(`\nScraping live prices across stores...`);
  const results = await Promise.all(
    candidates.map(async (c) => {
      const res = await scrapePrice(c.url, c.platform);
      return {
        platform: c.platform,
        url: c.url,
        title: c.title,
        price: res.price,
      };
    })
  );

  console.log(`\nResults:`);
  results.forEach((r) => {
    console.log(
      ` - ${r.platform.padEnd(10)}: ${
        r.price ? `₹${r.price.toLocaleString("en-IN")}` : "Price not found"
      } (${r.url})`
    );
  });

  const valid = results.filter((r) => r.price !== null && r.price > 0);
  if (valid.length > 0) {
    valid.sort((a, b) => a.price! - b.price!);
    const lowest = valid[0];
    const suggestedTarget = Math.round((lowest.price! * 0.95) / 100) * 100;
    console.log(`\n======================================================`);
    console.log(`🏆 Lowest Price Store: ${lowest.platform.toUpperCase()} at ₹${lowest.price!.toLocaleString("en-IN")}`);
    console.log(`🎯 Suggested Target Threshold: ₹${suggestedTarget.toLocaleString("en-IN")}`);
    console.log(`🔗 Winning Store URL: ${lowest.url}`);
    console.log(`⏱️ Total Time: ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
    console.log(`======================================================\n`);
  } else {
    console.log(`\nNo live prices extracted.`);
  }

  await closeBrowser();
}

main().catch((err) => {
  console.error("Test search error:", err);
  process.exit(1);
});
