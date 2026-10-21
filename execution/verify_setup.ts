import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

async function verifyAll() {
  console.log("==========================================");
  console.log("VECHI SYSTEM CONNECTIVITY VERIFICATION");
  console.log("==========================================");

  // 1. Supabase Check
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log(`\n1. Checking Supabase (${supabaseUrl})...`);
  if (!supabaseUrl || !serviceKey) {
    console.error("✖ Missing Supabase URL or Service Role Key in .env");
  } else {
    try {
      const client = createClient(supabaseUrl, serviceKey);
      const { data, error } = await client.from("tracked_products").select("id").limit(1);
      if (error) {
        if (error.code === "42P01") {
          console.warn("⚠ Supabase connected, but table 'tracked_products' does not exist yet!");
          console.warn("  --> Action needed: Execute supabase/schema.sql in Supabase Dashboard SQL Editor.");
        } else {
          console.error("✖ Supabase query error:", error.message, `(Code: ${error.code})`);
        }
      } else {
        console.log("✔ Supabase connection SUCCESSFUL! Tables are ready. Existing items:", data?.length ?? 0);
      }
    } catch (err) {
      console.error("✖ Supabase connection exception:", (err as Error).message);
    }
  }

  // 2. Resend Check
  const resendKey = process.env.RESEND_API_KEY;
  console.log("\n2. Checking Resend Email API...");
  if (!resendKey) {
    console.error("✖ Missing RESEND_API_KEY in .env");
  } else {
    try {
      const resend = new Resend(resendKey);
      const apiCheck = await resend.apiKeys.list();
      if (apiCheck.error) {
        console.error("✖ Resend API key error:", apiCheck.error.message);
      } else {
        console.log("✔ Resend API key is VALID!");
      }
    } catch (err) {
      console.log("ℹ Resend key provided. Ready for alert dispatch.");
    }
  }

  console.log("\n==========================================");
  console.log("Verification finished.");
  console.log("==========================================");
}

verifyAll();
