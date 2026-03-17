const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

const SITEMAP_INDEX = "https://www.pteinc.com/sitemap_index.xml";
const DATA_DIR = path.join(__dirname, "..", "data");

async function fetchXml(url) {
  const { data } = await axios.get(url, { timeout: 15000 });
  return data;
}

async function getSitemapUrls() {
  const xml = await fetchXml(SITEMAP_INDEX);
  const $ = cheerio.load(xml, { xmlMode: true });
  const sitemaps = [];
  $("sitemap loc").each((_, el) => $(el).text() && sitemaps.push($(el).text()));

  const pageUrls = [];
  for (const sitemapUrl of sitemaps) {
    console.log(`Fetching sitemap: ${sitemapUrl}`);
    const sitemapXml = await fetchXml(sitemapUrl);
    const $s = cheerio.load(sitemapXml, { xmlMode: true });
    $s("url loc").each((_, el) => {
      const loc = $s(el).text();
      if (loc) pageUrls.push(loc);
    });
  }
  return pageUrls;
}

function cleanText(text) {
  return text
    .replace(/\s+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function scrapePage(url) {
  try {
    const { data } = await axios.get(url, { timeout: 15000 });
    const $ = cheerio.load(data);

    // Remove scripts, styles, nav, footer, sidebars
    $("script, style, nav, footer, .sidebar, .widget, .menu, noscript, iframe").remove();

    const title = $("h1").first().text().trim() || $("title").text().trim();
    const metaDesc = $('meta[name="description"]').attr("content") || "";

    // Get main content - try common WordPress selectors
    let content = "";
    const selectors = [
      "article",
      ".entry-content",
      ".post-content",
      ".page-content",
      "main",
      ".elementor-widget-container",
      "#content",
    ];

    for (const sel of selectors) {
      if ($(sel).length) {
        content = $(sel).text();
        break;
      }
    }

    if (!content) {
      content = $("body").text();
    }

    content = cleanText(content);

    if (content.length < 50) {
      console.log(`  Skipping (too short): ${url}`);
      return null;
    }

    return { url, title, metaDesc, content };
  } catch (err) {
    console.log(`  Error scraping ${url}: ${err.message}`);
    return null;
  }
}

function chunkText(text, maxChunkSize = 800, overlap = 100) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks = [];
  let current = "";

  for (const sentence of sentences) {
    if ((current + sentence).length > maxChunkSize && current.length > 0) {
      chunks.push(current.trim());
      // Keep overlap from end of previous chunk
      const words = current.split(" ");
      const overlapWords = words.slice(-Math.floor(overlap / 5));
      current = overlapWords.join(" ") + " " + sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

async function main() {
  console.log("Fetching sitemap URLs...");
  const urls = await getSitemapUrls();
  console.log(`Found ${urls.length} URLs\n`);

  // Filter out non-content pages
  const skipPatterns = [
    "/login", "/logout", "/password-reset", "/user-page",
    "/privacy-policy", "/terms-conditions", "/twilio-services",
  ];

  const contentUrls = urls.filter(
    (u) => !skipPatterns.some((p) => u.includes(p))
  );
  console.log(`Scraping ${contentUrls.length} content pages...\n`);

  const pages = [];
  const chunks = [];

  for (const url of contentUrls) {
    console.log(`Scraping: ${url}`);
    const page = await scrapePage(url);
    if (page) {
      pages.push(page);
      const pageChunks = chunkText(page.content);
      for (let i = 0; i < pageChunks.length; i++) {
        chunks.push({
          id: `${pages.length - 1}_${i}`,
          url: page.url,
          title: page.title,
          content: pageChunks[i],
        });
      }
    }
    // Be polite to the server
    await new Promise((r) => setTimeout(r, 300));
  }

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  fs.writeFileSync(
    path.join(DATA_DIR, "pages.json"),
    JSON.stringify(pages, null, 2)
  );
  fs.writeFileSync(
    path.join(DATA_DIR, "chunks.json"),
    JSON.stringify(chunks, null, 2)
  );

  console.log(`\nDone! Scraped ${pages.length} pages, created ${chunks.length} chunks.`);
  console.log(`Data saved to ${DATA_DIR}/`);
}

main().catch(console.error);
