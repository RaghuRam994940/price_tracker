import { chromium, Browser } from "playwright";
import * as cheerio from "cheerio";

import {
  type SupportedPlatform,
  cleanPrice,
  detectPlatform,
} from "../lib/platforms";

export {
  type SupportedPlatform,
  cleanPrice,
  detectPlatform,
};

const DESKTOP_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "en-IN,en;q=0.9,hi;q=0.8",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};

let sharedBrowser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!sharedBrowser || !sharedBrowser.isConnected()) {
    sharedBrowser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });
  }
  return sharedBrowser;
}

export async function closeBrowser(): Promise<void> {
  if (sharedBrowser && sharedBrowser.isConnected()) {
    await sharedBrowser.close();
    sharedBrowser = null;
  }
}

/**
 * 2-TIER EXTRACTOR: CROMA
 * Tier 1: Fast HTTP GET parsing JSON-LD and Next.js __NEXT_DATA__
 * Tier 2: Headless Playwright evaluating dynamic DOM selectors
 */
export async function getCromaPrice(url: string): Promise<number | null> {
  // --- TIER 1: FAST PATH ---
  try {
    const res = await fetch(url, {
      headers: DESKTOP_HEADERS,
      redirect: "follow",
    });

    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);

      // Check all script[type="application/ld+json"] tags
      const jsonLdScripts = $('script[type="application/ld+json"]').toArray();
      for (const el of jsonLdScripts) {
        const content = $(el).html();
        if (content) {
          try {
            const parsed = JSON.parse(content);
            const offers = parsed.offers || (Array.isArray(parsed) ? parsed[0]?.offers : null);
            const price = Array.isArray(offers) ? offers[0]?.price : offers?.price;
            const cleaned = cleanPrice(price);
            if (cleaned !== null) return cleaned;
          } catch {
            // Robust fallback: regex extraction for malformed JSON-LD (e.g. Croma's trailing brace typo)
            const priceMatch = content.match(/"price"\s*:\s*["']?(\d+(?:\.\d+)?)["']?/i);
            if (priceMatch) {
              const cleaned = cleanPrice(priceMatch[1]);
              if (cleaned !== null) return cleaned;
            }
          }
        }
      }

      // Check Next.js internal hydration blob
      const nextData = $("#__NEXT_DATA__").html();
      if (nextData) {
        try {
          const parsed = JSON.parse(nextData);
          const pageProps = parsed?.props?.pageProps;
          const sellingPrice =
            pageProps?.initialData?.price?.sellingPrice ||
            pageProps?.productDetails?.price?.sellingPrice ||
            pageProps?.data?.price?.sellingPrice;
          const cleaned = cleanPrice(sellingPrice);
          if (cleaned !== null) return cleaned;
        } catch {
          const nextPriceMatch = nextData.match(/"(?:sellingPrice|price)"\s*:\s*["']?(\d+(?:\.\d+)?)["']?/i);
          if (nextPriceMatch) {
            const cleaned = cleanPrice(nextPriceMatch[1]);
            if (cleaned !== null) return cleaned;
          }
        }
      }

      // Fallback regex across entire raw HTML for product price
      const htmlPriceMatch = html.match(/"offers"\s*:\s*\{[^}]*"price"\s*:\s*["']?(\d+(?:\.\d+)?)["']?/i);
      if (htmlPriceMatch) {
        const cleaned = cleanPrice(htmlPriceMatch[1]);
        if (cleaned !== null) return cleaned;
      }
    }
  } catch (err) {
    console.warn(`[Croma Tier 1 Fast Path Error] ${url}:`, (err as Error).message);
  }

  // --- TIER 2: HEADLESS PLAYWRIGHT FALLBACK ---
  try {
    const browser = await getBrowser();
    const context = await browser.newContext({
      userAgent: DESKTOP_HEADERS["User-Agent"],
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });

      // Selector candidates for Croma price display
      const priceText = await page.evaluate(() => {
        const selectors = [
          '[data-testid="new-price"]',
          '.amount',
          '.pdpPrice',
          '.cp-price',
          '.discounted-price',
          'span.pdp-discounted-price',
          'div.price',
        ];
        for (const selector of selectors) {
          const el = document.querySelector(selector);
          if (el && el.textContent) {
            const text = el.textContent.trim();
            if (/\d/.test(text)) return text;
          }
        }
        return null;
      });

      if (priceText) {
        const cleaned = cleanPrice(priceText);
        if (cleaned !== null) return cleaned;
      }
    } finally {
      await page.close();
      await context.close();
    }
  } catch (err) {
    console.error(`[Croma Tier 2 Playwright Error] ${url}:`, (err as Error).message);
  }

  return null;
}

/**
 * 2-TIER EXTRACTOR: AMAZON
 */
export async function getAmazonPrice(url: string): Promise<number | null> {
  // Fast Path: Cheerio parse for JSON-LD or static price elements
  try {
    const res = await fetch(url, {
      headers: DESKTOP_HEADERS,
      redirect: "follow",
    });

    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);

      // JSON-LD check
      const jsonLd = $('script[type="application/ld+json"]').html();
      if (jsonLd) {
        try {
          const parsed = JSON.parse(jsonLd);
          const price = parsed?.offers?.price || parsed?.offers?.[0]?.price;
          const cleaned = cleanPrice(price);
          if (cleaned !== null) return cleaned;
        } catch {}
      }

      // Static DOM offscreen elements
      const offscreenPrice =
        $(".a-price .a-offscreen").first().text() ||
        $("#priceblock_ourprice").text() ||
        $("#priceblock_dealprice").text();
      const cleaned = cleanPrice(offscreenPrice);
      if (cleaned !== null) return cleaned;
    }
  } catch {}

  // Headless Fallback
  try {
    const browser = await getBrowser();
    const context = await browser.newContext({
      userAgent: DESKTOP_HEADERS["User-Agent"],
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      const priceText = await page.evaluate(() => {
        const selectors = [
          ".a-price .a-offscreen",
          "#priceblock_ourprice",
          "#priceblock_dealprice",
          "#corePrice_desktop .a-offscreen",
          ".apexPriceToPay .a-offscreen",
        ];
        for (const selector of selectors) {
          const el = document.querySelector(selector);
          if (el && el.textContent) {
            const text = el.textContent.trim();
            if (/\d/.test(text)) return text;
          }
        }
        return null;
      });

      if (priceText) {
        return cleanPrice(priceText);
      }
    } finally {
      await page.close();
      await context.close();
    }
  } catch (err) {
    console.error(`[Amazon Playwright Error] ${url}:`, (err as Error).message);
  }

  return null;
}

/**
 * 2-TIER EXTRACTOR: FLIPKART
 */
export async function getFlipkartPrice(url: string): Promise<number | null> {
  // Fast Path: Cheerio parse
  try {
    const res = await fetch(url, {
      headers: DESKTOP_HEADERS,
      redirect: "follow",
    });

    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);

      // JSON-LD
      const jsonLd = $('script[type="application/ld+json"]').html();
      if (jsonLd) {
        try {
          const parsed = JSON.parse(jsonLd);
          const price = parsed?.offers?.price || parsed?.offers?.[0]?.price;
          const cleaned = cleanPrice(price);
          if (cleaned !== null) return cleaned;
        } catch {}
      }

      // Flipkart specific price class names
      const priceText = $("div._30jeq3._16J0da").text() || $("div.Nx9bqj").first().text();
      const cleaned = cleanPrice(priceText);
      if (cleaned !== null) return cleaned;
    }
  } catch {}

  // Headless Fallback
  try {
    const browser = await getBrowser();
    const context = await browser.newContext({
      userAgent: DESKTOP_HEADERS["User-Agent"],
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      const priceText = await page.evaluate(() => {
        const selectors = [
          "div._30jeq3._16J0da",
          "div.Nx9bqj",
          "div._30jeq3",
          "._16J0da",
        ];
        for (const selector of selectors) {
          const el = document.querySelector(selector);
          if (el && el.textContent) {
            const text = el.textContent.trim();
            if (/\d/.test(text)) return text;
          }
        }
        return null;
      });

      if (priceText) {
        return cleanPrice(priceText);
      }
    } finally {
      await page.close();
      await context.close();
    }
  } catch (err) {
    console.error(`[Flipkart Playwright Error] ${url}:`, (err as Error).message);
  }

  return null;
}

/**
 * Universal Scraper Dispatcher based on detected platform
 */
export async function scrapePrice(
  url: string,
  platformOverride?: SupportedPlatform
): Promise<{ price: number | null; platform: SupportedPlatform }> {
  const platform = platformOverride || detectPlatform(url);

  let price: number | null = null;
  switch (platform) {
    case "croma":
      price = await getCromaPrice(url);
      break;
    case "amazon":
      price = await getAmazonPrice(url);
      break;
    case "flipkart":
      price = await getFlipkartPrice(url);
      break;
    default:
      // Try Croma general parser as first attempt then Amazon
      price = await getCromaPrice(url);
      if (price === null) {
        price = await getAmazonPrice(url);
      }
      break;
  }

  return { price, platform };
}
