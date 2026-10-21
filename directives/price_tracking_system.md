# Directive: Vechi Multi-Store Price Intelligence System

## Objective
Provide autonomous, deterministic price tracking across Croma, Amazon, and Flipkart. Deliver transactional alerts via Resend when a monitored product's price drops below a user's target threshold.

## 3-Layer System Mapping
1. **Directive (Layer 1)**: This SOP and rules defining scraper priorities, rate-limits, deduplication, and failovers.
2. **Orchestration (Layer 2)**: Antigravity agent routing tasks, running test scripts, investigating parsing changes, annealing broken selectors.
3. **Execution (Layer 3)**:
   - `worker/scraper.ts`: 2-tier extractor (Fast HTTP/JSON-LD + Playwright Chromium).
   - `worker/check_prices.ts`: Full database inspection, threshold comparison, and Resend alert dispatch.
   - `execution/test_scraper.ts`: Deterministic CLI tool for testing single URLs.
   - `execution/test_email.ts`: Deterministic CLI tool for testing Resend alert formatting.

## Core Extraction Flow
- **Croma**:
  - Fast Path: Fetch desktop HTML, inspect `<script type="application/ld+json">` (`offers.price`), inspect `<script id="__NEXT_DATA__">` (`initialData.price.sellingPrice`).
  - Headless Fallback: Launch Playwright Chromium, wait for DOM content, evaluate `[data-testid="new-price"]`, `.amount`, `.pdpPrice`.
- **Amazon**:
  - JSON-LD or offscreen price selectors (`.a-price .a-offscreen`, `#priceblock_ourprice`).
- **Flipkart**:
  - JSON-LD or DOM pricing containers (`div._30jeq3._16J0da`, `div.Nx9bqj`).
- **Price Cleaner**:
  - Strip `₹`, commas, whitespace. Parse positive float values (`cleanPrice()`).

## Notification Rules & Deduplication
- Alerts fire ONLY if `lowestFoundPrice <= target_price`.
- Deduplication check against `price_alert_logs`: Do not dispatch if an alert for `product_id` was sent within the past 24 hours.
- Email delivery formatted in responsive dark tech styling with direct store CTA button.

## Self-Annealing & Troubleshooting
- If a platform alters price selectors, test the URL with `npx tsx execution/test_scraper.ts <url>`.
- Inspect the output HTML/DOM and add the new selector to the platform selector list in `worker/scraper.ts`.
- Re-run test to verify before deploying.
