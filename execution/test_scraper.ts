import "dotenv/config";
import { scrapePrice, detectPlatform, closeBrowser } from "../worker/scraper";

async function main() {
  const targetUrl = process.argv[2];

  if (!targetUrl) {
    console.log("Usage: npx tsx execution/test_scraper.ts <product-url>");
    console.log("Example: npx tsx execution/test_scraper.ts https://www.croma.com/...");
    process.exit(1);
  }

  console.log(`[Vechi Test Scraper] Testing URL: ${targetUrl}`);
  const platform = detectPlatform(targetUrl);
  console.log(`[Vechi Test Scraper] Detected Platform: ${platform.toUpperCase()}`);

  const start = Date.now();
  try {
    const result = await scrapePrice(targetUrl);
    const duration = ((Date.now() - start) / 1000).toFixed(2);

    console.log("-----------------------------------------");
    console.log(`Status: ${result.price !== null ? "SUCCESS" : "PRICE NOT FOUND"}`);
    console.log(`Extracted Price: ${result.price !== null ? `₹${result.price}` : "null"}`);
    console.log(`Elapsed Time: ${duration}s`);
    console.log("-----------------------------------------");
  } catch (err) {
    console.error("Scraper encountered an unhandled error:", err);
  } finally {
    await closeBrowser();
  }
}

main();
