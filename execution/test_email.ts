import "dotenv/config";
import { Resend } from "resend";

async function main() {
  const recipient = process.argv[2] || process.env.TEST_EMAIL_RECIPIENT;
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || "Vechi Alerts <alerts@resend.dev>";

  if (!apiKey) {
    console.error("Missing RESEND_API_KEY in .env");
    process.exit(1);
  }

  if (!recipient) {
    console.log("Usage: npx tsx execution/test_email.ts <your-email@example.com>");
    process.exit(1);
  }

  console.log(`[Vechi Test Email] Sending test alert to: ${recipient}...`);
  const resend = new Resend(apiKey);

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: recipient,
      subject: "🚨 [Test] Vechi Price Drop Alert: ₹37,990 on Sony PlayStation 5!",
      html: `
        <div style="background-color:#080c14;color:#ffffff;padding:24px;font-family:sans-serif;border-radius:12px;">
          <h2 style="color:#00e5ff;margin-top:0;">VECHI TEST NOTIFICATION</h2>
          <p>This is a verified test email from the Vechi price monitoring engine.</p>
          <div style="background:#0f172a;padding:16px;border-radius:8px;border:1px solid #1e293b;margin:16px 0;">
            <p style="margin:4px 0;">Product: <strong>Sony PlayStation 5 Slim Digital</strong></p>
            <p style="margin:4px 0;">Target: <strong>₹40,000</strong></p>
            <p style="margin:4px 0;color:#10b981;font-size:18px;">Current Price: <strong>₹37,990 (CROMA)</strong></p>
          </div>
          <p style="color:#94a3b8;font-size:12px;">Vechi automated email pipeline is operational.</p>
        </div>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
    } else {
      console.log("✔ Test email dispatched successfully! ID:", data?.id);
    }
  } catch (err) {
    console.error("Failed to send test email:", err);
  }
}

main();
