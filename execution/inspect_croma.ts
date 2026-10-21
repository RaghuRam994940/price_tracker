import { chromium } from "playwright";
import * as cheerio from "cheerio";

async function inspect() {
  const url = "https://www.croma.com/hp-hyperx-omen-15-ga0005tx-intel-core-i7-14th-gen-gaming-laptop-24gb-1tb-ssd-windows-11-home-8gb-graphics-15-inch-180-hz-wqxga-ips-display-nvidia-geforce-rtx-5060-ms-office-home-2024-shadow-black-2-21-kg-/p/321361";
  
  console.log("--> Testing HTTP fetch...");
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      }
    });
    console.log("Fetch Status:", res.status);
    const html = await res.text();
    console.log("HTML length:", html.length);
    const $ = cheerio.load(html);
    console.log("Title:", $("title").text());
    console.log("Scripts count:", $("script").length);
    
    // Check if there is json-ld
    $('script[type="application/ld+json"]').each((i, el) => {
      console.log(`JSON-LD [${i}]:`, $(el).html()?.substring(0, 150));
    });
  } catch (e) {
    console.error("Fetch error:", e);
  }

  console.log("\n--> Testing Playwright Chromium...");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
    const title = await page.title();
    console.log("Playwright Page Title:", title);
    
    const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500));
    console.log("Body preview:", bodyText.replace(/\n+/g, " "));
  } catch (err) {
    console.error("Playwright error:", err);
  } finally {
    await browser.close();
  }
}

inspect();
