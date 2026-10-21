import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vechi — Intelligent Multi-Store Price Tracker",
  description:
    "Track product prices across Croma, Amazon, and Flipkart. Get instant transactional alerts the moment prices drop below your custom threshold.",
  keywords: ["price tracker", "croma price tracker", "amazon price drop", "flipkart deals", "price drop alerts"],
  authors: [{ name: "Vechi" }],
};

export const viewport: Viewport = {
  themeColor: "#080c14",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-slate-100 antialiased selection:bg-brand selection:text-background min-h-screen">
        {children}
      </body>
    </html>
  );
}
