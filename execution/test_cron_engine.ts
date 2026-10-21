/**
 * Standalone Execution Script: Run and verify OmniDrop V2 Autonomous Cron Engine
 * Usage: npx tsx execution/test_cron_engine.ts
 */
import "dotenv/config";
import { runCronEngine } from "../worker/cron_engine";

async function main() {
  console.log("==================================================================");
  console.log("OmniDrop V2: Testing Autonomous Background Engine (Offline Runner)");
  console.log("==================================================================");

  await runCronEngine();
}

main().catch((err) => {
  console.error("Test cron engine execution failed:", err);
  process.exit(1);
});
