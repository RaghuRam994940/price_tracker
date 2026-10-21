/**
 * ==============================================================================
 * OMNIDROP V2: AUTONOMOUS BACKGROUND PRICE TRACKING & GMAIL DISPATCH ENGINE
 * ==============================================================================
 * Operates 100% offline and independently of the web frontend.
 * Run automatically via GitHub Actions Cron every 4 hours or local scheduler.
 * 
 * Capabilities:
 *  1. Bypasses RLS using SUPABASE_SERVICE_ROLE_KEY to query all active items.
 *  2. 2-Tier Price Extraction:
 *     - Tier 1: Fast HTTP GET + Cheerio for JSON-LD & Next.js state.
 *     - Tier 2: Headless Playwright Chromium evaluating live DOM selectors.
 *  3. Price drop evaluation: current_price <= target_price.
 *  4. 24-hour alert deduplication against price_alert_logs table.
 *  5. Direct Gmail inbox delivery via Resend API with direct "Buy Now" link.
 *  6. Supabase Free-Tier Protection & Auto-Pruning:
 *     - Deletes alert logs older than 15 days.
 *     - Suspends stale items (is_active = false) unchanged for > 60 days.
 *     - Cleans expired search cache records.
 * ==============================================================================
 */

import "dotenv/config";
import WebSocket from "ws";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { scrapePrice, closeBrowser } from "./scraper";
import { SupportedPlatform } from "../lib/platforms";

// Ensure global WebSocket is available across any Node.js runtime (Node 18/20/22+)
if (typeof (globalThis as any).WebSocket === "undefined") {
  (globalThis as any).WebSocket = WebSocket;
}

// --- ENVIRONMENT CONFIGURATION ---
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "OmniDrop Alerts <onboarding@resend.dev>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("FATAL: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
  process.exit(1);
}

// Bypasses Row Level Security (RLS) to process all users in the background
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

// --- TYPES ---
interface ProductLink {
  id: string;
  product_id: string;
  platform: SupportedPlatform;
  url: string;
  is_primary: boolean;
  last_price: number | null;
  last_checked_at: string | null;
}

interface TrackedProduct {
  id: string;
  user_id: string;
  user_email: string;
  title: string;
  target_price: number;
  current_price: number | null;
  is_active: boolean;
  last_price_change_at: string;
  product_links: ProductLink[];
}

function formatINR(val: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(val);
}

/**
 * Builds responsive, high-contrast dark-mode HTML email template for Gmail
 */
function buildGmailAlertTemplate(params: {
  productTitle: string;
  currentPrice: number;
  targetPrice: number;
  platform: string;
  storeUrl: string;
  appUrl: string;
}): string {
  const savings = Math.max(0, params.targetPrice - params.currentPrice);
  const formattedCurrent = formatINR(params.currentPrice);
  const formattedTarget = formatINR(params.targetPrice);
  const formattedSavings = formatINR(savings);
  const platformName = params.platform.toUpperCase();

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Price Drop Alert - OmniDrop</title>
</head>
<body style="margin:0;padding:0;background-color:#080c14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#080c14;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="580" style="max-width:580px;background-color:#0f172a;border:1px solid #1e293b;border-radius:14px;overflow:hidden;box-shadow:0 12px 36px rgba(0,0,0,0.6);">
          
          <!-- Header Bar -->
          <tr>
            <td style="padding:28px 32px;background:linear-gradient(135deg, #0f172a 0%, #131d35 100%);border-bottom:1px solid #1e293b;">
              <table width="100%">
                <tr>
                  <td>
                    <span style="font-size:22px;font-weight:900;letter-spacing:-0.5px;color:#00e5ff;">OMNIDROP</span>
                    <span style="font-size:11px;color:#94a3b8;margin-left:8px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Price Radar</span>
                  </td>
                  <td align="right">
                    <span style="background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.3);padding:4px 12px;border-radius:999px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;">Target Unlocked</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Product Title & Alert Heading -->
          <tr>
            <td style="padding:32px 32px 20px 32px;">
              <p style="margin:0 0 8px 0;font-size:12px;font-weight:700;color:#00e5ff;text-transform:uppercase;letter-spacing:1.5px;">Deal Alert</p>
              <h1 style="margin:0 0 12px 0;font-size:20px;font-weight:800;color:#ffffff;line-height:1.4;">
                ${params.productTitle}
              </h1>
              <p style="margin:0;font-size:14px;color:#94a3b8;line-height:1.6;">
                Great news! The price on <strong style="color:#ffffff;">${platformName}</strong> dropped below your target threshold.
              </p>
            </td>
          </tr>

          <!-- Price Metric Comparison Box -->
          <tr>
            <td style="padding:0 32px 28px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#1e293b;border:1px solid #334155;border-radius:12px;padding:20px;">
                <tr>
                  <td width="50%" style="padding:12px;border-right:1px solid #334155;">
                    <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;font-weight:600;margin-bottom:4px;">
                      Current Price (${platformName})
                    </div>
                    <div style="font-size:26px;font-weight:900;color:#10b981;line-height:1.1;">
                      ${formattedCurrent}
                    </div>
                  </td>
                  <td width="50%" style="padding:12px 12px 12px 20px;">
                    <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;font-weight:600;margin-bottom:4px;">
                      Your Target Budget
                    </div>
                    <div style="font-size:20px;font-weight:700;color:#cbd5e1;line-height:1.1;">
                      ${formattedTarget}
                    </div>
                    ${
                      savings > 0
                        ? `<div style="font-size:12px;color:#38bdf8;margin-top:4px;font-weight:600;">You save ${formattedSavings}</div>`
                        : ""
                    }
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- High-Contrast Direct CTA Button -->
          <tr>
            <td style="padding:0 32px 32px 32px;" align="center">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${params.storeUrl}" target="_blank" style="display:block;width:100%;max-width:340px;background:linear-gradient(135deg, #00e5ff 0%, #00b4d8 100%);color:#080c14;font-size:15px;font-weight:800;text-decoration:none;padding:15px 24px;border-radius:10px;text-align:center;box-shadow:0 4px 14px rgba(0,229,255,0.4);letter-spacing:0.3px;">
                      Buy Now on ${platformName} ➔
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:16px;">
                    <a href="${params.appUrl}/dashboard" target="_blank" style="font-size:12px;color:#64748b;text-decoration:none;font-weight:500;">
                      View & Manage in OmniDrop Dashboard
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background-color:#0b1120;border-top:1px solid #1e293b;text-align:center;">
              <p style="margin:0;font-size:11px;color:#64748b;line-height:1.5;">
                Automated offline alert dispatched by OmniDrop V2 Background Engine.<br>
                Runs 24/7 in the cloud without requiring your browser to be open.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * 24-Hour Alert Deduplication Check
 */
async function hasAlertedRecently(productId: string): Promise<boolean> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("price_alert_logs")
    .select("id")
    .eq("product_id", productId)
    .gte("sent_at", twentyFourHoursAgo)
    .limit(1);

  if (error) {
    console.warn(`[Deduplication Check Error] Product ${productId}:`, error.message);
    return false;
  }

  return (data && data.length > 0) || false;
}

/**
 * Dispatches Email Alert via Resend & Logs to Database
 */
async function dispatchAlert(
  product: TrackedProduct,
  winningPrice: number,
  platform: string,
  winningUrl: string
): Promise<boolean> {
  if (!resend) {
    console.log(`[Alert Skipped] RESEND_API_KEY is not configured in .env.`);
    return false;
  }

  // Recipient: User's verified email
  const recipient = product.user_email;
  const subject = `🚨 Price Drop Alert: "${product.title}" is now ${formatINR(winningPrice)}!`;
  const html = buildGmailAlertTemplate({
    productTitle: product.title,
    currentPrice: winningPrice,
    targetPrice: product.target_price,
    platform,
    storeUrl: winningUrl,
    appUrl: APP_URL,
  });

  try {
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: RESEND_FROM_EMAIL,
      to: recipient,
      subject,
      html,
    });

    if (emailError) {
      console.error(`[Resend Error] Failed to send email to ${recipient}:`, emailError);
      return false;
    }

    console.log(`[Email Dispatched] Alert successfully sent to ${recipient} (Email ID: ${emailData?.id})`);

    // Log alert in price_alert_logs
    const { error: logErr } = await supabase.from("price_alert_logs").insert({
      product_id: product.id,
      user_id: product.user_id,
      user_email: product.user_email,
      notified_price: winningPrice,
      threshold_price: product.target_price,
      platform,
      product_url: winningUrl,
    });

    if (logErr) {
      console.warn(`[Alert Log Insert Error]:`, logErr.message);
    }

    return true;
  } catch (err) {
    console.error(`[Alert Exception] Failed sending email for ${product.title}:`, err);
    return false;
  }
}

/**
 * Supabase Free-Tier Protection: Auto-prunes logs & suspends stale items
 */
async function executeDatabaseMaintenance(): Promise<void> {
  console.log(`\n======================================================`);
  console.log(`[OmniDrop Maintenance] Executing Free-Tier Pruning & Suspensions...`);
  console.log(`======================================================`);

  // 1. Auto-Prune alert logs older than 15 days
  try {
    const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
    const { error: pruneErr } = await supabase
      .from("price_alert_logs")
      .delete()
      .lt("sent_at", fifteenDaysAgo);

    if (pruneErr) {
      console.warn(`[Maintenance Warning] Failed pruning old alert logs:`, pruneErr.message);
    } else {
      console.log(`✓ Auto-pruned price_alert_logs older than 15 days.`);
    }
  } catch (err) {
    console.warn(`[Maintenance Exception] Pruning alert logs:`, (err as Error).message);
  }

  // 2. Suspend stale tracking items unchanged for > 60 days (is_active = false)
  try {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const { error: suspendErr } = await supabase
      .from("tracked_products")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("is_active", true)
      .lt("last_price_change_at", sixtyDaysAgo);

    if (suspendErr) {
      console.warn(`[Maintenance Warning] Failed suspending stale items:`, suspendErr.message);
    } else {
      console.log(`✓ Stale items (>60 days without price drop) suspended to conserve compute.`);
    }
  } catch (err) {
    console.warn(`[Maintenance Exception] Suspending stale items:`, (err as Error).message);
  }

  // 3. Prune expired search cache entries
  try {
    const nowIso = new Date().toISOString();
    const { error: cacheErr } = await supabase
      .from("search_cache")
      .delete()
      .lt("expires_at", nowIso);

    if (cacheErr) {
      console.warn(`[Maintenance Warning] Failed pruning expired search cache:`, cacheErr.message);
    } else {
      console.log(`✓ Pruned expired search_cache entries.`);
    }
  } catch {}
}

/**
 * Main Autonomous Cron Engine Entrypoint
 */
export async function runCronEngine(): Promise<void> {
  const startTime = Date.now();
  console.log(`\n======================================================`);
  console.log(`[OmniDrop V2 Cron Engine] Starting Autonomous Price Tracking...`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`======================================================\n`);

  // Step 1: Run maintenance pruning
  await executeDatabaseMaintenance();

  // Step 2: Fetch all active tracked products joined with product_links
  let rawProducts: any[] = [];
  
  // Try querying with V2 schema (is_active, last_price_change_at)
  const { data: v2Data, error: v2Error } = await supabase
    .from("tracked_products")
    .select(`
      id,
      user_id,
      user_email,
      title,
      target_price,
      current_price,
      is_active,
      last_price_change_at,
      product_links (
        id,
        product_id,
        platform,
        url,
        is_primary,
        last_price,
        last_checked_at
      )
    `)
    .eq("is_active", true);

  if (!v2Error && v2Data) {
    rawProducts = v2Data;
  } else {
    console.log(`[Schema Notice] is_active column not yet migrated. Falling back to V1 product query.`);
    const { data: v1Data, error: v1Error } = await supabase
      .from("tracked_products")
      .select(`
        id,
        user_id,
        user_email,
        title,
        target_price,
        current_price,
        product_links (
          id,
          product_id,
          platform,
          url,
          is_primary,
          last_price,
          last_checked_at
        )
      `);

    if (v1Error) {
      console.error("FATAL: Failed to query tracked_products:", v1Error);
      return;
    }
    rawProducts = v1Data || [];
  }

  const products = (rawProducts as unknown as TrackedProduct[]) || [];
  console.log(`\n[Cron Engine] Found ${products.length} active products to evaluate.`);

  if (products.length === 0) {
    console.log("[Cron Engine] No active tracked products. Exiting cleanly.");
    return;
  }

  let totalLinksChecked = 0;
  let totalAlertsDispatched = 0;

  // Step 3: Iterate through products and their store links
  for (const product of products) {
    console.log(`\n------------------------------------------------------`);
    console.log(`Product: "${product.title}"`);
    console.log(`Target Price: ${formatINR(product.target_price)} | User: ${product.user_email}`);
    console.log(`Store Links Count: ${product.product_links?.length || 0}`);

    const links = product.product_links || [];
    if (links.length === 0) {
      console.log("No store links attached to this product. Skipping.");
      continue;
    }

    let lowestValidPrice: number | null = null;
    let lowestPlatform: string | null = null;
    let lowestUrl: string | null = null;

    // Scrape prices across all store links for this product
    for (const link of links) {
      totalLinksChecked++;
      console.log(` → Scraping [${link.platform.toUpperCase()}] ${link.url}`);

      try {
        const scrapeResult = await scrapePrice(link.url, link.platform);
        const newPrice = scrapeResult.price;

        if (newPrice !== null && newPrice > 0) {
          console.log(`   Price Found: ${formatINR(newPrice)}`);

          // Update product_links record in Supabase
          const { error: updateErr } = await supabase
            .from("product_links")
            .update({
              last_price: newPrice,
              last_checked_at: new Date().toISOString(),
            })
            .eq("id", link.id);

          if (updateErr) {
            console.warn(`   Failed to update link price in DB:`, updateErr.message);
          }

          // Track absolute lowest price found across stores for this product
          if (lowestValidPrice === null || newPrice < lowestValidPrice) {
            lowestValidPrice = newPrice;
            lowestPlatform = link.platform;
            lowestUrl = link.url;
          }
        } else {
          console.log(`   Price: null or blocked.`);
          await supabase
            .from("product_links")
            .update({ last_checked_at: new Date().toISOString() })
            .eq("id", link.id);
        }
      } catch (scrapeErr) {
        console.warn(`   Scrape error on ${link.url}:`, (scrapeErr as Error).message);
      }
    }

    // Update parent product current_price and lowest store link
    if (lowestValidPrice !== null) {
      const updatePayload: Record<string, any> = {
        current_price: lowestValidPrice,
        lowest_platform: lowestPlatform,
        lowest_url: lowestUrl,
        updated_at: new Date().toISOString(),
      };

      if ("last_price_change_at" in product && product.last_price_change_at) {
        const priceDroppedOrChanged = lowestValidPrice !== product.current_price;
        updatePayload.last_price_change_at = priceDroppedOrChanged
          ? new Date().toISOString()
          : product.last_price_change_at;
      }

      const { error: updateProdErr } = await supabase
        .from("tracked_products")
        .update(updatePayload)
        .eq("id", product.id);

      if (updateProdErr && updateProdErr.code === "42703") {
        delete updatePayload.last_price_change_at;
        await supabase.from("tracked_products").update(updatePayload).eq("id", product.id);
      }

      console.log(`Lowest Store: ${lowestPlatform?.toUpperCase()} at ${formatINR(lowestValidPrice)}`);

      // Step 4: Evaluate Threshold & 24h Deduplication
      if (lowestValidPrice <= product.target_price) {
        console.log(`🎯 THRESHOLD HIT! Current: ${formatINR(lowestValidPrice)} <= Target: ${formatINR(product.target_price)}`);

        const alreadyAlerted = await hasAlertedRecently(product.id);
        if (alreadyAlerted) {
          console.log(`ℹ️ Alert suppressed: An email was already dispatched for this item in the last 24h.`);
        } else {
          console.log(`📧 Dispatching offline alert directly to user's Gmail (${product.user_email})...`);
          const sent = await dispatchAlert(product, lowestValidPrice, lowestPlatform!, lowestUrl!);
          if (sent) totalAlertsDispatched++;
        }
      } else {
        console.log(`Price (${formatINR(lowestValidPrice)}) is above target (${formatINR(product.target_price)}). No alert sent.`);
      }
    }
  }

  // Close browser instance if Playwright was invoked
  await closeBrowser();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n======================================================`);
  console.log(`[OmniDrop V2 Cron Engine] Run Completed Successfully.`);
  console.log(`Total Products: ${products.length} | Links Polled: ${totalLinksChecked}`);
  console.log(`Alerts Dispatched: ${totalAlertsDispatched} | Elapsed Time: ${elapsed}s`);
  console.log(`======================================================\n`);
}

// Execute standalone if executed directly via CLI or GitHub Actions
if (require.main === module) {
  runCronEngine()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Cron engine fatal failure:", err);
      process.exit(1);
    });
}
