import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { scrapePrice, closeBrowser, SupportedPlatform } from "./scraper";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("FATAL: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

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
  product_links: ProductLink[];
}

function formatINR(val: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(val);
}

function buildAlertEmailHtml(params: {
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

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Price Drop Alert - Vechi</title>
</head>
<body style="margin:0;padding:0;background-color:#080c14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#080c14;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="580" style="max-width:580px;background-color:#0f172a;border:1px solid #1e293b;border-radius:12px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.5);">
          
          <!-- Header -->
          <tr>
            <td style="padding:28px 32px;background:linear-gradient(135deg, #0f172a 0%, #131d35 100%);border-bottom:1px solid #1e293b;">
              <table width="100%">
                <tr>
                  <td>
                    <span style="font-size:22px;font-weight:800;letter-spacing:-0.5px;color:#00e5ff;">VECHI</span>
                    <span style="font-size:12px;color:#94a3b8;margin-left:8px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Price Intelligence</span>
                  </td>
                  <td align="right">
                    <span style="background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.3);padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Target Reached</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 12px 0;font-size:20px;font-weight:700;color:#ffffff;line-height:1.4;">
                ${params.productTitle}
              </h1>
              <p style="margin:0 0 24px 0;font-size:14px;color:#94a3b8;line-height:1.5;">
                Great news! The item you were tracking on <strong style="color:#00e5ff;">${params.platform.toUpperCase()}</strong> just dropped below your target price.
              </p>

              <!-- Price Comparison Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#080c14;border:1px solid #1e293b;border-radius:8px;margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 20px;border-right:1px solid #1e293b;text-align:center;" width="50%">
                    <div style="font-size:11px;font-weight:600;text-transform:uppercase;color:#94a3b8;letter-spacing:0.5px;margin-bottom:4px;">Target Price</div>
                    <div style="font-size:18px;font-weight:700;color:#e2e8f0;text-decoration:line-through;">${formattedTarget}</div>
                  </td>
                  <td style="padding:16px 20px;text-align:center;" width="50%">
                    <div style="font-size:11px;font-weight:600;text-transform:uppercase;color:#10b981;letter-spacing:0.5px;margin-bottom:4px;">Current Price</div>
                    <div style="font-size:24px;font-weight:800;color:#10b981;">${formattedCurrent}</div>
                  </td>
                </tr>
                ${
                  savings > 0
                    ? `<tr>
                    <td colspan="2" style="padding:10px 20px;border-top:1px solid #1e293b;text-align:center;background-color:rgba(16,185,129,0.06);">
                      <span style="font-size:13px;font-weight:700;color:#10b981;">You save ${formattedSavings}</span>
                    </td>
                  </tr>`
                    : ""
                }
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${params.storeUrl}" target="_blank" style="display:inline-block;background-color:#00e5ff;color:#080c14;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:8px;box-shadow:0 4px 14px rgba(0,229,255,0.4);text-transform:uppercase;letter-spacing:0.5px;">
                      Buy Now on ${params.platform.toUpperCase()} &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <div style="margin-top:28px;padding-top:20px;border-top:1px solid #1e293b;text-align:center;">
                <a href="${params.appUrl}/dashboard" style="font-size:12px;color:#64748b;text-decoration:underline;">
                  Manage Tracked Items in Vechi Dashboard
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background-color:#080c14;border-top:1px solid #1e293b;text-align:center;">
              <p style="margin:0;font-size:12px;color:#475569;line-height:1.5;">
                Sent automatically by Vechi Automated Price Intelligence.<br>
                Alerts are rate-limited to at most once per 24 hours per product.
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

export async function checkAllPrices(): Promise<{
  checkedCount: number;
  alertsSent: number;
  errors: number;
}> {
  console.log(`[Vechi Worker] Starting scheduled price check run at ${new Date().toISOString()}...`);

  let checkedCount = 0;
  let alertsSent = 0;
  let errors = 0;

  try {
    // 1. Fetch all tracked products with their store links
    const { data: products, error: prodError } = await supabase
      .from("tracked_products")
      .select(`
        id,
        user_id,
        user_email,
        title,
        target_price,
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

    if (prodError) {
      throw new Error(`Failed to query tracked_products: ${prodError.message}`);
    }

    if (!products || products.length === 0) {
      console.log("[Vechi Worker] No products currently tracked in the database.");
      return { checkedCount: 0, alertsSent: 0, errors: 0 };
    }

    console.log(`[Vechi Worker] Found ${products.length} product(s) to verify across users.`);

    for (const prod of products as unknown as TrackedProduct[]) {
      console.log(`\n--> Checking product [${prod.id}]: "${prod.title}" (Target: ₹${prod.target_price})`);

      let lowestFoundPrice: number | null = null;
      let winningLinkUrl = "";
      let winningPlatform = "";

      for (const link of prod.product_links) {
        checkedCount++;
        console.log(`   Scanning [${link.platform}]: ${link.url}`);

        try {
          const { price } = await scrapePrice(link.url, link.platform);

          if (price !== null) {
            console.log(`   ✔ Extracted price: ₹${price} for ${link.platform}`);

            // Update product_links record with last price and checked timestamp
            await supabase
              .from("product_links")
              .update({
                last_price: price,
                last_checked_at: new Date().toISOString(),
              })
              .eq("id", link.id);

            if (lowestFoundPrice === null || price < lowestFoundPrice) {
              lowestFoundPrice = price;
              winningLinkUrl = link.url;
              winningPlatform = link.platform;
            }
          } else {
            console.warn(`   ✖ Could not extract price for ${link.url}`);
          }
        } catch (linkErr) {
          errors++;
          console.error(`   ✖ Error checking link ${link.url}:`, (linkErr as Error).message);
        }
      }

      // 2. Evaluate if lowest price <= target threshold
      if (lowestFoundPrice !== null && lowestFoundPrice <= prod.target_price) {
        console.log(
          `   🎯 Threshold met! Lowest ₹${lowestFoundPrice} <= Target ₹${prod.target_price} on ${winningPlatform}`
        );

        // Check deduplication log (1 alert per 24 hours per product)
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: recentAlerts, error: logCheckError } = await supabase
          .from("price_alert_logs")
          .select("id")
          .eq("product_id", prod.id)
          .gte("sent_at", twentyFourHoursAgo);

        if (logCheckError) {
          console.error("   Error querying price_alert_logs:", logCheckError.message);
        }

        if (recentAlerts && recentAlerts.length > 0) {
          console.log("   ⏳ Skipping notification: Alert already sent within the past 24 hours.");
          continue;
        }

        // Send Email via Resend
        if (!resend) {
          console.warn("   ⚠ RESEND_API_KEY not configured. Skipping email dispatch.");
          continue;
        }

        try {
          const emailSubject = `🚨 Price Drop Alert: ₹${lowestFoundPrice} for ${prod.title}!`;
          const emailHtml = buildAlertEmailHtml({
            productTitle: prod.title,
            currentPrice: lowestFoundPrice,
            targetPrice: prod.target_price,
            platform: winningPlatform,
            storeUrl: winningLinkUrl,
            appUrl: APP_URL,
          });

          const { error: sendError } = await resend.emails.send({
            from: RESEND_FROM_EMAIL,
            to: prod.user_email,
            subject: emailSubject,
            html: emailHtml,
          });

          if (sendError) {
            console.error("   ✖ Resend email dispatch failed:", sendError);
          } else {
            alertsSent++;
            console.log(`   ✉ Email alert successfully dispatched to ${prod.user_email}`);

            // Record alert in audit log table
            await supabase.from("price_alert_logs").insert({
              product_id: prod.id,
              notified_price: lowestFoundPrice,
              sent_at: new Date().toISOString(),
            });
          }
        } catch (emailErr) {
          errors++;
          console.error("   ✖ Failed to send Resend email:", (emailErr as Error).message);
        }
      } else if (lowestFoundPrice !== null) {
        console.log(
          `   ℹ Price ₹${lowestFoundPrice} is currently above target ₹${prod.target_price}.`
        );
      }
    }
  } finally {
    await closeBrowser();
  }

  console.log(
    `\n[Vechi Worker] Finished run. Checked: ${checkedCount} links, Sent: ${alertsSent} alerts, Errors: ${errors}.`
  );

  return { checkedCount, alertsSent, errors };
}

// Auto-run if executed directly as entrypoint
if (require.main === module) {
  checkAllPrices()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Fatal worker execution crash:", err);
      process.exit(1);
    });
}
