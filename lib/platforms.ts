export type SupportedPlatform = "croma" | "amazon" | "flipkart" | "other";

/**
 * Universal price sanitizer converting strings like "₹ 1,49,990.00" into float 149990.
 */
export function cleanPrice(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") {
    return isNaN(raw) || raw <= 0 ? null : Number(raw.toFixed(2));
  }

  // Remove commas, currency symbols, and extra whitespace
  // Keep numbers and periods
  const sanitized = String(raw)
    .replace(/,/g, "")
    .replace(/[^0-9.]/g, " ")
    .trim();

  // Find first continuous floating or integer number
  const match = sanitized.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;

  const value = parseFloat(match[1]);
  return isNaN(value) || value <= 0 ? null : Number(value.toFixed(2));
}

/**
 * Detect e-commerce platform from URL
 */
export function detectPlatform(url: string): SupportedPlatform {
  const lower = url.toLowerCase();
  if (lower.includes("croma.com")) return "croma";
  if (lower.includes("amazon.in") || lower.includes("amazon.com") || lower.includes("amzn.to"))
    return "amazon";
  if (lower.includes("flipkart.com")) return "flipkart";
  return "other";
}
