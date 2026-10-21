import "dotenv/config";
import { Resend } from "resend";
import { scrapePrice, detectPlatform, closeBrowser } from "../worker/scraper";

function formatINR(val: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(val);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed: {
    url?: string;
    to?: string;
    target?: number;
    mockPrice?: number;
    title?: string;
  } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--url" && args[i + 1]) {
      parsed.url = args[++i];
    } else if (arg === "--to" && args[i + 1]) {
      parsed.to = args[++i];
    } else if (arg === "--target" && args[i + 1]) {
      parsed.target = parseFloat(args[++i]);
    } else if (arg === "--mock-price" && args[i + 1]) {
      parsed.mockPrice = parseFloat(args[++i]);
    } else if (arg === "--title" && args[i + 1]) {
      parsed.title = args[++i];
    } else if (!parsed.url && arg.startsWith("http")) {
      parsed.url = arg;
    } else if (!parsed.to && arg.includes("@")) {
      parsed.to = arg;
    }
  }

  return parsed;
}

async function main() {
  const args = parseArgs();
  const testUrl = args.url || "https://www.croma.com/apple-iphone-15-128gb-black-/p/300652";
  const recipient = args.to || process.env.TEST_EMAIL_RECIPIENT;
  const productTitle = args.title || "Apple iPhone 15 (128GB, Black)";
  const targetPrice = args.target || 65000;

  console.log("=================================================");
  console.log("VECHI ALERT ENGINE DRY-RUN / INTEGRATION TEST");
  console.log("=================================================");
  console.log(`Product Title : ${productTitle}`);
  console.log(`Target Price  : ${formatINR(targetPrice)}`);
  console.log(`Target URL    : ${testUrl}`);
  console.log(`Alert To      : ${recipient || "(Not specified - pass --to email@example.com)"}`);
  console.log("-------------------------------------------------");

  // 1. Scraper Test
  const platform = detectPlatform(testUrl);
  console.log(`[1/3] Detecting platform... Detected: ${platform.toUpperCase()}`);

  let currentPrice: number | null = args.mockPrice ?? null;

  if (currentPrice !== null) {
    console.log(`[2/3] Using provided mock price: ${formatINR(currentPrice)}`);
  } else {
    console.log(`[2/3] Executing 2-Tier Scraper against ${platform.toUpperCase()}...`);
    const startTime = Date.now();
    try {
      const result = await scrapePrice(testUrl, platform);
      currentPrice = result.price;
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      if (currentPrice !== null) {
        console.log(`✔ Scraper succeeded in ${duration}s! Extracted Price: ${formatINR(currentPrice)}`);
      } else {
        console.warn(`✖ Scraper did not find a numeric price in ${duration}s. Simulating a test price for email verification.`);
        currentPrice = targetPrice - 2000; // Fallback mock price for email verification
      }
    } catch (err) {
      console.error("✖ Scraper error:", (err as Error).message);
      currentPrice = targetPrice - 2000;
    } finally {
      await closeBrowser();
    }
  }

  // 2. Check Price Drop Condition
  const isDrop = currentPrice !== null && currentPrice <= targetPrice;
  console.log(`\nPrice Threshold Evaluation:`);
  console.log(`- Current Price: ${formatINR(currentPrice)}`);
  console.log(`- Target Price : ${formatINR(targetPrice)}`);
  console.log(`- Condition Met: ${isDrop ? "YES (PRICE DROP TRIGGERED)" : "NO"}`);

  // 3. Email Dispatch Test
  console.log(`\n[3/3] Resend Email Pipeline Test...`);
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  if (!apiKey) {
    console.error("✖ Missing RESEND_API_KEY in .env");
    return;
  }

  if (!recipient) {
    console.log("ℹ Pass a recipient email with --to your@email.com to send a live test message.");
    console.log("Example: npx tsx scripts/test_alert.ts --to user@example.com --url https://www.croma.com/...");
    return;
  }

  const resend = new Resend(apiKey);
  const emailSubject = `🚨 Price Drop Alert: ₹${currentPrice} for ${productTitle}!`;
  const savings = Math.max(0, targetPrice - (currentPrice ?? 0));

  const emailHtml = `
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
          <tr>
            <td style="padding:24px 32px;background:linear-gradient(135deg, #0f172a 0%, #131d35 100%);border-bottom:1px solid #1e293b;">
              <span style="font-size:22px;font-weight:800;letter-spacing:-0.5px;color:#00e5ff;">VECHI</span>
              <span style="background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.3);padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700;text-transform:uppercase;float:right;">
                ${platform.toUpperCase()} DROP
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 12px 0;font-size:20px;font-weight:700;color:#ffffff;line-height:1.4;">
                ${productTitle}
              </h1>
              <p style="margin:0 0 24px 0;font-size:14px;color:#94a3b8;line-height:1.5;">
                Target price reached on <strong style="color:#00e5ff;">${platform.toUpperCase()}</strong>!
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#080c14;border:1px solid #1e293b;border-radius:8px;margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 20px;border-right:1px solid #1e293b;text-align:center;" width="50%">
                    <div style="font-size:11px;font-weight:600;text-transform:uppercase;color:#94a3b8;margin-bottom:4px;">Target Budget</div>
                    <div style="font-size:18px;font-weight:700;color:#e2e8f0;text-decoration:line-through;">${formatINR(targetPrice)}</div>
                  </td>
                  <td style="padding:16px 20px;text-align:center;" width="50%">
                    <div style="font-size:11px;font-weight:600;text-transform:uppercase;color:#10b981;margin-bottom:4px;">Current Price</div>
                    <div style="font-size:24px;font-weight:800;color:#10b981;">${formatINR(currentPrice!)}</div>
                  </td>
                </tr>
                ${
                  savings > 0
                    ? `<tr>
                    <td colspan="2" style="padding:10px 20px;border-top:1px solid #1e293b;text-align:center;background-color:rgba(16,185,129,0.06);">
                      <span style="font-size:13px;font-weight:700;color:#10b981;">You save ${formatINR(savings)}</span>
                    </td>
                  </tr>`
                    : ""
                }
              </table>

              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${testUrl}" target="_blank" style="display:inline-block;background-color:#00e5ff;color:#080c14;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:8px;text-transform:uppercase;letter-spacing:0.5px;">
                      Buy Now on ${platform.toUpperCase()} &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;background-color:#080c14;border-top:1px solid #1e293b;text-align:center;">
              <p style="margin:0;font-size:11px;color:#475569;">
                [Dry-Run Test Notification] Vechi Automated Background Price Intelligence.
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

  console.log(`Sending email from: ${fromEmail} to: ${recipient}...`);
  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: recipient,
      subject: emailSubject,
      html: emailHtml,
    });

    if (error) {
      console.error("✖ Resend API error:", error);
    } else {
      console.log(`✔ Resend email dispatched successfully! ID: ${data?.id}`);
    }
  } catch (err) {
    console.error("✖ Error dispatching email:", (err as Error).message);
  }

  console.log("=================================================");
}

main().catch((err) => {
  console.error("Execution failed:", err);
  process.exit(1);
});
