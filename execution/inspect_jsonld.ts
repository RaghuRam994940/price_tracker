import * as cheerio from "cheerio";

async function inspectJsonLd() {
  const url = "https://www.croma.com/hp-hyperx-omen-15-ga0005tx-intel-core-i7-14th-gen-gaming-laptop-24gb-1tb-ssd-windows-11-home-8gb-graphics-15-inch-180-hz-wqxga-ips-display-nvidia-geforce-rtx-5060-ms-office-home-2024-shadow-black-2-21-kg-/p/321361";
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
  });
  const html = await res.text();
  const $ = cheerio.load(html);
  
  $('script[type="application/ld+json"]').each((i, el) => {
    const raw = $(el).html();
    console.log(`=== SCRIPT ${i} ===`);
    try {
      const parsed = JSON.parse(raw!);
      console.log(JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.log("Raw string error:", raw);
    }
  });
}

inspectJsonLd();
