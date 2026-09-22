import { execFileSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getSupabasePublicConfig } from "./lib/soma-public-config.mjs";

const ADSENSE_PUBLISHER_ID = "ca-pub-3097294735250340";
const SITE_URL = "https://somanovel.uk";
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "contact@somanovel.uk";
const { url: SUPABASE_URL, key: SUPABASE_ANON_KEY } = await getSupabasePublicConfig();
const output = resolve("public/books");
const publicCatalogueOutput = resolve("public/catalog/books.json");
const homeIndexPath = resolve("index.html");

const escapeHtml = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");
const absoluteUrl = (value) => {
  const candidate = value || "/covers/voices_beneath_the_baobab_en.jpg";
  try {
    const url = new URL(candidate, SITE_URL);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : `${SITE_URL}/covers/voices_beneath_the_baobab_en.jpg`;
  } catch {
    return `${SITE_URL}/covers/voices_beneath_the_baobab_en.jpg`;
  }
};
const languageLabel = (language) => language === "sw" ? "Kiswahili" : "English";
const legalFooter = `<footer style="clear:both;margin-top:40px;padding-top:18px;border-top:1px solid #d9dfd8;font-size:14px"><strong>Soma Novel</strong><nav aria-label="Legal and site information" style="display:flex;flex-wrap:wrap;gap:12px 18px;margin-top:10px"><a href="/about">About</a><a href="/contact">Contact</a><a href="/privacy-policy">Privacy Policy</a><a href="/cookie-policy">Cookie Policy</a><a href="/terms">Terms of Service</a><a href="mailto:${CONTACT_EMAIL}">Email us</a></nav></footer>`;

async function fetchRows(path) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const raw = execFileSync("curl", [
    "-s", "-S",
    url,
    "-H", `apikey: ${SUPABASE_ANON_KEY}`,
    "-H", `authorization: Bearer ${SUPABASE_ANON_KEY}`,
    "-H", "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36"
  ], { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
  return JSON.parse(raw);
}

const booksQuery = new URLSearchParams({
  select: "id,parent_book_id,slug,title,author_name,description,cover_url,language_code,category,tags,total_chapters,is_featured,published_at,created_at,updated_at",
  status: "eq.published",
  or: `(published_at.is.null,published_at.lte.${new Date(Date.now() + 5 * 60 * 1000).toISOString()})`,
  order: "is_featured.desc,created_at.desc",
});
const books = await fetchRows(`books?${booksQuery}`);

// The browser can preload this same-origin catalogue while the JavaScript
// bundle downloads. This removes the cross-origin Supabase request from the
// homepage's critical rendering path while keeping the catalogue generated
// from the exact records used for the static SEO pages.
await mkdir(resolve("public/catalog"), { recursive: true });
await writeFile(publicCatalogueOutput, `${JSON.stringify(books)}\n`);

const isClassicRow = (book) => /(?:^|[\s_-])(?:classics?|literature)(?:$|[\s_-])|classic-literature|literature-classic/.test(
  [book.category, ...(book.tags || [])].join(" ").toLowerCase(),
);
const homeHeroBook = books.find((book) => book.is_featured && book.language_code === "en" && !isClassicRow(book) && book.cover_url)
  || books.find((book) => book.language_code === "en" && !isClassicRow(book) && book.cover_url);
const homeIndex = await readFile(homeIndexPath, "utf8");
const featuredPreloadPattern = /<!-- HOME_FEATURED_PRELOAD_START -->[\s\S]*?<!-- HOME_FEATURED_PRELOAD_END -->/;
if (!featuredPreloadPattern.test(homeIndex)) throw new Error("Homepage featured-cover preload markers are missing.");
if (homeHeroBook) {
  const featuredCover = absoluteUrl(homeHeroBook.cover_url);
  const featuredOrigin = new URL(featuredCover).origin;
  const featuredPreload = `<!-- HOME_FEATURED_PRELOAD_START -->\n    <link rel="preconnect" href="${escapeHtml(featuredOrigin)}" crossorigin />\n    <link rel="preload" as="image" href="${escapeHtml(featuredCover)}" fetchpriority="high" />\n    <!-- HOME_FEATURED_PRELOAD_END -->`;
  const updatedHomeIndex = homeIndex.replace(featuredPreloadPattern, featuredPreload);
  await writeFile(homeIndexPath, updatedHomeIndex);
} else {
  await writeFile(homeIndexPath, homeIndex.replace(
    featuredPreloadPattern,
    '<!-- HOME_FEATURED_PRELOAD_START -->\n    <!-- No English modern cover is available to preload. -->\n    <!-- HOME_FEATURED_PRELOAD_END -->',
  ));
}
const byRoot = new Map();
for (const book of books) {
  const root = book.parent_book_id || book.id;
  byRoot.set(root, [...(byRoot.get(root) || []), book]);
}

// This directory is fully generated from the current published catalogue.
// Recreate it on every run so deleted or renamed slugs cannot survive as stale
// static HTML and continue returning 200 after the database record is gone.
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const allChapters = await fetchRows(`chapters?${new URLSearchParams({
  select: "book_id,chapter_number,title,word_count",
  status: "eq.published",
  order: "chapter_number.asc",
})}`);
const chaptersByBookId = new Map();
for (const ch of allChapters) {
  if (!chaptersByBookId.has(ch.book_id)) {
    chaptersByBookId.set(ch.book_id, []);
  }
  chaptersByBookId.get(ch.book_id).push(ch);
}

const pages = [];

for (const book of books) {
  const chapters = chaptersByBookId.get(book.id) || [];
  const canonical = `${SITE_URL}/books/${encodeURIComponent(book.slug)}/`;
  const cover = absoluteUrl(book.cover_url);
  const versions = (byRoot.get(book.parent_book_id || book.id) || []).filter((item) => item.slug !== book.slug);
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Book",
        name: book.title,
        author: { "@type": "Person", name: book.author_name || "Soma Originals" },
        description: book.description || `Read ${book.title} on Soma Novel.`,
        image: cover,
        inLanguage: book.language_code === "sw" ? "sw" : "en",
        genre: book.category || "Web novel",
        url: canonical,
        numberOfPages: chapters.length,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Soma Novel", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Books", item: `${SITE_URL}/books/` },
          { "@type": "ListItem", position: 3, name: book.title, item: canonical },
        ],
      },
    ],
  };
  const chapterList = chapters.map((chapter) => {
    const href = `/read/${encodeURIComponent(book.slug)}/${chapter.chapter_number}`;
    const label = `Chapter ${chapter.chapter_number}${chapter.title ? `: ${chapter.title}` : ""}`;
    return `<li><a href="${href}">${escapeHtml(label)}</a></li>`;
  }).join("\n");
  const readerHref = chapters.length ? `/read/${encodeURIComponent(book.slug)}/${chapters[0].chapter_number}` : "/";
  const languageLinks = versions.length
    ? `<p class="versions">Also available: ${versions.map((version) => `<a href="/books/${encodeURIComponent(version.slug)}/">${languageLabel(version.language_code)}</a>`).join(" · ")}</p>`
    : "";
  // hreflang + x-default for translated pairs. Without this, Google may
  // index the Swahili and English editions as duplicates and pick one
  // arbitrarily. x-default points at the English edition.
  const selfLang = book.language_code === "sw" ? "sw" : "en";
  const hreflangTags = [
    `<link rel="alternate" hreflang="${selfLang}" href="${canonical}">`,
    ...versions.map((version) => {
      const altLang = version.language_code === "sw" ? "sw" : "en";
      const altCanonical = `${SITE_URL}/books/${encodeURIComponent(version.slug)}/`;
      return `<link rel="alternate" hreflang="${altLang}" href="${altCanonical}">`;
    }),
    `<link rel="alternate" hreflang="x-default" href="${canonical}">`,
  ].join("\n  ");
  const html = `<!doctype html>
<html lang="${book.language_code === "sw" ? "sw" : "en"}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(book.title)} | Soma Novel</title>
  <meta name="description" content="${escapeHtml(book.description || `Read ${book.title} on Soma Novel.`)}">
  <link rel="canonical" href="${canonical}">
  ${hreflangTags}
  <meta name="robots" content="index,follow,max-image-preview:large">
  <meta name="google-adsense-account" content="${ADSENSE_PUBLISHER_ID}">
  <meta name="google-adsense-platform-account" content="${ADSENSE_PUBLISHER_ID}">
  <meta name="google-adsense-platform-domain" content="somanovel.uk">
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUBLISHER_ID}" crossorigin="anonymous"></script>
  <meta property="og:type" content="book"><meta property="og:site_name" content="Soma Novel">
  <meta property="og:title" content="${escapeHtml(book.title)}"><meta property="og:description" content="${escapeHtml(book.description || "Read free on Soma Novel.")}">
  <meta property="og:url" content="${escapeHtml(canonical)}"><meta property="og:image" content="${escapeHtml(cover)}">
  <script type="application/ld+json">${JSON.stringify(schema).replaceAll("<", "\\u003c")}</script>
  <style>body{max-width:760px;margin:0 auto;padding:32px 20px;font:17px/1.65 system-ui,sans-serif;color:#102321;background:#f8f7f2}a{color:#9e3c19}img{width:180px;max-width:45%;border-radius:14px;float:right;margin:0 0 22px 26px}h1{line-height:1.15}.eyebrow{font-weight:700;color:#9e3c19}.meta,.versions{color:#50615e}li{margin:8px 0}@media(max-width:540px){img{float:none;max-width:100%;width:240px;margin:0 0 20px}}</style>
</head>
<body>
  <nav><a href="/">Soma Novel</a> / <a href="/books/">Books</a></nav>
  <p class="eyebrow">${languageLabel(book.language_code)} · ${escapeHtml(book.category || "Web novel")}</p>
  <img src="${escapeHtml(cover)}" alt="Cover of ${escapeHtml(book.title)}">
  <h1>${escapeHtml(book.title)}</h1>
  <p class="meta">By ${escapeHtml(book.author_name || "Soma Originals")} · ${chapters.length} chapters · Free to read</p>
${languageLinks ? `  ${languageLinks}\n` : ""}  <p>${escapeHtml(book.description || `Read ${book.title} free on Soma Novel.`)}</p>
  <p><a href="${readerHref}">Read on Soma Novel</a></p>
  <h2>Chapters</h2><ol>${chapterList}</ol>
  ${legalFooter}
</body></html>`;
  const directory = resolve(output, book.slug);
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, "index.html"), html);
  pages.push({
    canonical,
    title: book.title,
    author: book.author_name || "Soma Originals",
    description: book.description || "",
    language: book.language_code,
    category: book.category || "Web novel",
    slug: book.slug,
    chapters: chapters.length,
    updated: book.updated_at || book.published_at,
  });
}

const catalogue = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>English & Kiswahili Web Novels | Soma Novel</title><meta name="description" content="Browse free English and Kiswahili web novels from East Africa on Soma Novel."><link rel="canonical" href="${SITE_URL}/books/"><meta name="robots" content="index,follow"><meta name="google-adsense-platform-account" content="${ADSENSE_PUBLISHER_ID}"><meta name="google-adsense-platform-domain" content="somanovel.uk"><script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUBLISHER_ID}" crossorigin="anonymous"></script><style>body{max-width:860px;margin:0 auto;padding:32px 20px;font:17px/1.6 system-ui,sans-serif;background:#f8f7f2;color:#102321}a{color:#9e3c19}li{margin:12px 0}</style></head><body><nav><a href="/">Soma Novel</a></nav><h1>English & Kiswahili Web Novels</h1><p>Free stories from East Africa, available in English and Kiswahili.</p><ul>${pages.map((page) => `<li><a href="${page.canonical.replace(SITE_URL, "")}">${escapeHtml(page.title)}</a></li>`).join("\n")}</ul>${legalFooter}</body></html>`;
await writeFile(resolve(output, "index.html"), catalogue);

const today = new Date().toISOString().slice(0, 10);
const pagesByLanguage = pages.reduce((accumulator, page) => {
  const bucket = page.language === "sw" ? "sw" : "en";
  accumulator[bucket].push(page);
  return accumulator;
}, { en: [], sw: [] });

// Build a /read/<slug>/<n> URL list for every chapter so that LLM crawlers
// can reach the full chapter text without having to discover chapter links
// through the static HTML. The chapter-number projection is regenerated by
// the same selector above (`chaptersQuery` selects `chapter_number` only),
// so we re-query the chapters table for the full URL set.
const chapterUrls = [];
for (const book of books) {
  const chaptersPage = chaptersByBookId.get(book.id) || [];
  for (const chapter of chaptersPage) {
    chapterUrls.push(`${SITE_URL}/read/${encodeURIComponent(book.slug)}/${chapter.chapter_number}`);
  }
}
// Sitemap is split into a sitemap-index with per-language + per-section
// children. Large flat sitemaps (>5k URLs) are harder for Google Search
// Console to load and parse, and they make it harder to spot section-level
// regressions. The split is purely operational; both languages remain
// indexable and the same canonical URLs are emitted.
const homeAndStatic = [
  `${SITE_URL}/`,
  `${SITE_URL}/books/`,
  `${SITE_URL}/about`,
  `${SITE_URL}/contact`,
];
const bookUrls = pages.map((page) => page.canonical);
const chapterUrlsAll = chapterUrls;
const enBookUrls = pagesByLanguage.en.map((page) => page.canonical);
const swBookUrls = pagesByLanguage.sw.map((page) => page.canonical);

function buildSitemapSet(items) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${items.map((entry) => {
  const priority = entry.url === `${SITE_URL}/`
    ? "1.0"
    : entry.url.startsWith(`${SITE_URL}/read/`)
      ? "0.6"
      : "0.8";
  const hreflang = (entry.hreflang || [])
    .map((alt) => `    <xhtml:link rel="alternate" hreflang="${alt.code}" href="${alt.url}" />\n`)
    .join("");
  const hrefSelf = entry.hreflang
    ? `    <xhtml:link rel="alternate" hreflang="${entry.hreflang[0].code}" href="${entry.url}" />\n`
    : "";
  return `  <url>
    <loc>${entry.url}</loc>
${hreflang}${hrefSelf}    <lastmod>${entry.lastmod || today}</lastmod>
    <changefreq>${entry.url.startsWith(`${SITE_URL}/read/`) ? "monthly" : "weekly"}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}).join("\n")}
</urlset>
`;
}

// Build canonical hreflang pairs across en/sw books. Two strategies are
// applied in order:
//   1. parent_book_id from the database, which the existing "Also
//      available" line already trusts;
//   2. slug-based pairing for stories whose Swahili twin was uploaded as
//      a brand-new row without parent_book_id. The Swahili slug is
//      derived from the English slug by stripping the trailing "-sw"
//      marker, which is the convention the upload pipeline already uses
//      (see scripts/upload-soma-books.mjs).
function buildAltLanguagesByCanonical() {
  const map = new Map();
  const swSlugToSw = new Map();
  for (const page of pagesByLanguage.sw) {
    swSlugToSw.set(page.slug, page);
  }
  for (const page of pages) {
    const siblings = new Map();
    // Strategy 1: parent_book_id.
    const grouped = (byRoot.get(page.parent_book_id || page.id) || [])
      .filter((item) => item.slug !== page.slug);
    for (const alt of grouped) {
      const code = alt.language === "sw" ? "sw" : "en";
      siblings.set(`${code}:${alt.canonical}`, {
        code,
        url: alt.canonical,
      });
    }
    // Strategy 2: slug-based pairing (only for English editions; the
    // Swahili twin is looked up by its stripped slug).
    if (page.language === "en") {
      const candidateSlug = `${page.slug}-sw`;
      const twin = swSlugToSw.get(candidateSlug);
      if (twin) {
        siblings.set(`sw:${twin.canonical}`, { code: "sw", url: twin.canonical });
      }
    }
    map.set(page.canonical, Array.from(siblings.values()));
  }
  return map;
}

const altLanguagesByCanonical = buildAltLanguagesByCanonical();

function annotate(urls) {
  return urls.map((url) => {
    const page = pages.find((p) => p.canonical === url);
    if (!page) return { url };
    const alternates = altLanguagesByCanonical.get(page.canonical) || [];
    return {
      url,
      hreflang: [{ code: page.language === "sw" ? "sw" : "en", url }, ...alternates],
    };
  });
}

const homeAndStaticEntries = homeAndStatic.map((url) => ({ url }));
const enEntries = annotate(enBookUrls);
const swEntries = annotate(swBookUrls);
const chapterEntries = chapterUrlsAll.map((url) => ({ url }));

await writeFile(resolve("public/sitemap-home.xml"), buildSitemapSet(homeAndStaticEntries));
await writeFile(resolve("public/sitemap-books-en.xml"), buildSitemapSet(enEntries));
await writeFile(resolve("public/sitemap-books-sw.xml"), buildSitemapSet(swEntries));
await writeFile(resolve("public/sitemap-chapters.xml"), buildSitemapSet(chapterEntries));

// sitemap-index references the four children. We keep /sitemap.xml as an
// alias so existing GSC submissions and old bookmarks continue to resolve.
const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${SITE_URL}/sitemap-home.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${SITE_URL}/sitemap-books-en.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${SITE_URL}/sitemap-books-sw.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${SITE_URL}/sitemap-chapters.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
</sitemapindex>
`;

await writeFile(resolve("public/sitemap.xml"), sitemapIndex);

await writeFile(resolve("public/robots.txt"), `# robots.txt — Soma Novel (somanovel.uk)
# This file is the authoritative policy for every crawler that respects
# RFC 9309. It is generated by scripts/build-seo-pages.mjs on every build
# so that human traffic, ad verification, and LLM crawlers all see the
# same up-to-date rules.

User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/

# Google AdSense crawler must be able to fetch every public page so ads.txt
# and the in-page ad units can be verified during the AdSense review.
User-agent: Mediapartners-Google
Allow: /

User-agent: Googlebot
Allow: /

# --- LLM and AI-search crawlers ---
# These bots read the catalogue so their chat answers can cite our books
# and link to the canonical URLs. We allow them on the whole site except
# /admin/ and /api/. They are also expected to honour the optional
# machine-readable policy at /llm-policy.json and the human-readable
# summary at /ai.txt.
User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: GPTBot
Disallow: /admin/
Disallow: /api/

User-agent: Google-Extended
Disallow: /admin/
Disallow: /api/

User-agent: ClaudeBot
Allow: /
Disallow: /admin/
Disallow: /api/

User-agent: Claude-User
Allow: /
Disallow: /admin/
Disallow: /api/

User-agent: anthropic-ai
Allow: /
Disallow: /admin/
Disallow: /api/

User-agent: PerplexityBot
Allow: /
Disallow: /admin/
Disallow: /api/

User-agent: Perplexity-User
Allow: /
Disallow: /admin/
Disallow: /api/

User-agent: CCBot
Allow: /
Disallow: /admin/
Disallow: /api/

User-agent: Applebot-Extended
Allow: /
Disallow: /admin/
Disallow: /api/

User-agent: Bytespider
Allow: /
Disallow: /admin/
Disallow: /api/

User-agent: cohere-ai
Allow: /
Disallow: /admin/
Disallow: /api/

User-agent: cohere-training-data-crawler
Disallow: /

User-agent: AmazonBedrock
Allow: /
Disallow: /admin/
Disallow: /api/

User-agent: Meta-ExternalAgent
Allow: /
Disallow: /admin/
Disallow: /api/

User-agent: MistralAI-User
Allow: /
Disallow: /admin/
Disallow: /api/

User-agent: DuckDuckBot
Allow: /
Disallow: /admin/
Disallow: /api/

Sitemap: ${SITE_URL}/sitemap.xml

# AI / LLM policy pointers (RFC 9309 does not define this format, but most
# LLM crawlers fetch these files when present).
# Machine-readable: ${SITE_URL}/llm-policy.json
# Human-readable: ${SITE_URL}/ai.txt
`);

// llm-policy.json is a small machine-readable file that LLM crawlers can
// read to understand the site's content licensing, attribution rules, and
// preferred citation format. The schema is informal but stable.
const llmPolicy = {
  policy_version: "2026-08-15",
  site: SITE_URL,
  site_name: "Soma Novel",
  contact: "contact@somanovel.uk",
  // Bilingual summary for both English and Kiswahili audiences.
  summary: {
    en: "Soma Novel publishes original web fiction in English and Kiswahili (side-by-side, free to read and download), re-typesets more than a thousand public-domain English classics for phone reading (free to read and download), and offers a free self-publishing uploader that accepts .txt and .epub files. No account is required to read or download.",
    sw: "Soma Novel inachapisha riwaya za mtandaoni kwa Kiingereza na Kiswahili (kwa pamoja, bure kusoma na kupakua), inapanga upya zaidi ya vitabu elfu moja vya kale vya Kiingereza kwa ajili ya kusoma kwenye simu (bure kusoma na kupakua), na inatoa kifungu cha bure cha kuchapisha mwenyewe kinachokubali faili za .txt na .epub. Hakuna haja ya akaunti ya kusoma au kupakua.",
  },
  // What content is available for AI consumption. Bilingual coverage only
  // applies to original web fiction — the re-typeset English classics are
  // English-only because their underlying public-domain source language
  // is English.
  crawlable: {
    book_pages: true,
    chapter_pages: true,
    catalogue: true,
    llms_txt: true,
    llms_full_txt: true,
    feed_xml: true,
    sitemap_xml: true,
  },
  // Three selling points phrased for both languages. The first one is the
  // only thing that is bilingual — the re-typeset classics section is
  // English-only because the underlying public-domain works are in
  // English. Self-publishing is bilingual because the uploader accepts
  // both languages.
  highlights: [
    {
      en: "Bilingual web fiction (爽文). Every original serial is published side-by-side in English and Kiswahili, fully free to read online and free to download as a complete book (TXT or EPUB).",
      sw: "Riwaya za mtandaoni (爽文) katika lugha mbili. Kila riwaya yetu ya asili inachapishwa kwa Kiingereza na Kiswahili, bure kabisa kusoma mtandaoni na bure kupakua kitabu kizima (TXT au EPUB).",
      scope: "original_web_fiction",
      languages: ["en", "sw"],
    },
    {
      en: "Re-typeset English classics. More than a thousand public-domain English works re-typeset for phone screens, free to read online and free to download as a complete book.",
      sw: "Vitabu vya kale vya Kiingereza vimepangwa upya. Zaidi ya vitabu elfu moja vya kale vya Kiingereza vimepangwa upya kwa skrini za simu, bure kusoma mtandaoni na bure kupakua kitabu kizima. (Vitabu hivi vya kale ni vya Kiingereza pekee, kwa sababu chanzo chao cha asili ni Kiingereza.)",
      scope: "re_typeset_classics",
      languages: ["en"],
    },
    {
      en: "Self-publishing. Readers can upload their own .txt or .epub manuscripts through the in-page uploader and read or share them immediately, free of charge. The uploader accepts both English and Kiswahili.",
      sw: "Kuchapisha mwenyewe. Wasomaji wanaweza kupakia hati zao za .txt au .epub kupitia kifungu cha kupakia, na kusoma au kushiriki mara moja, bila malipo. Kifungu cha kupakia kinakubali lugha zote mbili: Kiingereza na Kiswahili.",
      scope: "self_publishing",
      languages: ["en", "sw"],
    },
  ],
  catalogue_layout: {
    original_web_fiction: {
      en_count: pagesByLanguage.en.length,
      sw_count: pagesByLanguage.sw.length,
      bilingual: true,
    },
    re_typeset_classics: {
      languages: ["en"],
      description_en: "Public-domain English works re-typeset for phone reading. English only.",
      description_sw: "Vitabu vya kale vya Kiingereza vimepangwa upya kwa ajili ya kusoma kwenye simu. Kiingereza pekee.",
    },
  },
  // Citation format we would like LLM answers to use.
  attribution: {
    format: "Title — Soma Novel — https://somanovel.uk/books/<slug>/",
    example_en: "The Night's Remedy — Soma Novel — https://somanovel.uk/books/the-night-s-remedy/",
    example_sw: "Dawa ya Usiku — Soma Novel — https://somanovel.uk/books/dawa-ya-usiku-sw/",
    rules: [
      "Do not reproduce full chapter text.",
      "Quote at most 90 characters and link to the source chapter URL.",
      "Prefer the canonical book URL over the chapter URL for general citations.",
      "Acknowledge bilingual availability (English + Kiswahili).",
    ],
  },
  machine_readable_files: {
    llms_txt: `${SITE_URL}/llms.txt`,
    llms_full_txt: `${SITE_URL}/llms-full.txt`,
    feed_xml: `${SITE_URL}/feed.xml`,
    sitemap: `${SITE_URL}/sitemap.xml`,
    sitemap_index: `${SITE_URL}/sitemap.xml`,
    sitemap_books_en: `${SITE_URL}/sitemap-books-en.xml`,
    sitemap_books_sw: `${SITE_URL}/sitemap-books-sw.xml`,
    sitemap_chapters: `${SITE_URL}/sitemap-chapters.xml`,
  },
  generated_at: new Date().toISOString(),
};

await writeFile(resolve("public/llm-policy.json"), JSON.stringify(llmPolicy, null, 2) + "\n");

// ai.txt is the human-readable counterpart to llm-policy.json. Both files
// share the same intent so that an operator or crawler that only
// understands one of the two formats still gets a useful answer. Note the
// explicit scope on each highlight: bilingual coverage only applies to
// original web fiction and self-published uploads — the re-typeset
// English classics are English-only.
const aiTxt = `# ai.txt — Soma Novel (somanovel.uk)
# Generated by scripts/build-seo-pages.mjs on every build.
# Last build: ${today}

# Catalogue layout / Muundo wa orodha ya vitabu

Soma Novel has two distinct catalogue sections. Bilingual coverage only
applies to the original web fiction section. The re-typeset English
classics are English-only, because their underlying public-domain source
language is English. / Soma Novel ina sehemu mbili tofauti za orodha ya
vitabu. Toleo la lugha mbili linatumika tu kwa sehemu ya riwaya za
mtandaoni za asili. Vitabu vya kale vya Kiingereza vilivyopangwa upya ni
vya Kiingereza pekee, kwa sababu chanzo chao cha asili ni Kiingereza.

- Original web fiction / Riwaya za mtandaoni za asili: ${pagesByLanguage.en.length} English + ${pagesByLanguage.sw.length} Kiswahili editions, published side-by-side.
- Re-typeset English classics / Vitabu vya kale vya Kiingereza vilivyopangwa upya: 1,000+ public-domain works, English only. / 1,000+ vitabu vya kale vya Kiingereza pekee.

# Three things Soma Novel does / Mambo matatu anayofanya Soma Novel

1. Bilingual web fiction (爽文) / Riwaya za mtandaoni (爽文) katika lugha mbili.
   Every original serial is published side-by-side in English and Kiswahili,
   fully free to read online and free to download as a complete book (TXT or EPUB).
   / Kila riwaya yetu ya asili inachapishwa kwa Kiingereza na Kiswahili, bure
   kabisa kusoma mtandaoni na bure kupakua kitabu kizima (TXT au EPUB).
   Scope: original web fiction only. Languages: English + Kiswahili.

2. Re-typeset English classics / Vitabu vya kale vya Kiingereza vimepangwa upya.
   More than a thousand public-domain English works have been professionally
   re-typeset for phone screens, free to read online and free to download as a
   complete book. / Zaidi ya vitabu elfu moja vya kale vya Kiingereza
   vimepangwa upya kitaalamu kwa skrini za simu, bure kusoma mtandaoni na bure
   kupakua kitabu kizima.
   Scope: classics section. Languages: English only. / Lugha: Kiingereza pekee.

3. Self-publishing / Kuchapisha mwenyewe.
   Readers can upload their own .txt or .epub manuscripts through the in-page
   uploader and read or share them immediately, free of charge. The uploader
   accepts both English and Kiswahili. / Wasomaji wanaweza kupakia hati zao
   za .txt au .epub kupitia kifungu cha kupakia, na kusoma au kushiriki mara
   moja, bila malipo. Kifungu cha kupakia kinakubali lugha zote mbili:
   Kiingereza na Kiswahili.
   Scope: self-published uploads. Languages: any, including English + Kiswahili.

All three features are free, with no account required to read or download. /
Huduma zote tatu ni bure, na hakuna haja ya akaunti ya kusoma au kupakua.

# Citation / Unukuzi

When citing a title, attribute Soma Novel and link to the canonical book
page. Do not reproduce full chapter text. If quoting, link to the source
chapter URL. Original web fiction titles can be cited in either English or
Kiswahili depending on the edition the reader is asking about — both are
canonical. Re-typeset classics are cited only in English because the source
language is English. / Unaponukuu kitabu, taja Soma Novel na weka kiungo
cha ukurasa wa asili wa kitabu hicho. Usinakili maandishi ya sura nzima.
Ukibidi kunukuu, weka kiungo cha URL ya sura. Vitabu vya asili vinaweza
kunukuliwa kwa Kiingereza au Kiswahili kulingana na toleo — vyote viwili
ni vya asili. Vitabu vya kale vinanukuliwa kwa Kiingereza pekee kwa sababu
lugha ya chanzo ni Kiingereza.

# Machine-readable companions / Viambatanisho vya mashine

- ${SITE_URL}/llms.txt
- ${SITE_URL}/llms-full.txt
- ${SITE_URL}/llm-policy.json
- ${SITE_URL}/feed.xml
- ${SITE_URL}/sitemap.xml
`;

await writeFile(resolve("public/ai.txt"), aiTxt);
function bookLlmEntry(page) {
  const summary = page.description
    ? ` — ${page.description.replace(/\s+/g, " ").slice(0, 220)}`
    : "";
  return `- [${page.title}](${page.canonical}) — ${page.author}, ${page.category}, ${page.chapters} chapters${summary}`;
}

const bookListEn = pagesByLanguage.en.map(bookLlmEntry).join("\n");
const bookListSw = pagesByLanguage.sw.map(bookLlmEntry).join("\n");

// Three selling points that LLM crawlers should be able to surface verbatim.
// Each one is written first in English and then in Kiswahili so a single
// file satisfies both audiences without forcing a translation step.
// Bilingual coverage only applies to original web fiction — the
// re-typeset English classics are English-only because the underlying
// public-domain source language is English.
const HIGHLIGHTS_EN = [
  "Bilingual web fiction (爽文). Every original serial is published side-by-side in English and Kiswahili, fully free to read online and free to download as a complete book (TXT or EPUB). Scope: original web fiction only.",
  "Re-typeset English classics. More than a thousand public-domain English works have been professionally re-typeset for phone screens — cleaner line spacing, sensible margins, distraction-free reader — free to read online and free to download as a complete book. Scope: classics section. English only — Kiswahili translations are not produced for these public-domain works.",
  "Self-publishing. Readers can upload their own .txt or .epub manuscripts through the in-page uploader (the uploader accepts English and Kiswahili) and read or share them immediately, free of charge.",
].join("\n\n");

const HIGHLIGHTS_SW = [
  "Riwaya za mtandaoni (爽文) katika lugha mbili. Kila riwaya yetu ya asili inachapishwa kwa Kiingereza na Kiswahili, hii ni bure kabisa kusoma mtandaoni na bure kupakua kitabu kizima (TXT au EPUB). Wigo: riwaya za mtandaoni za asili pekee.",
  "Vitabu vya kale vya Kiingereza vimepangwa upya. Zaidi ya vitabu elfu moja vya kale vya Kiingereza — novela, hadithi fupi, na vitabu vya marejeleo — vimepangwa upya kwa skrini za simu, na vinapatikana bure kusoma mtandaoni na bure kupakua kitabu kizima. Wigo: sehemu ya vitabu vya kale. Kiingereza pekee — tafsiri za Kiswahili hazitengenezwi kwa vitabu hivi vya kale.",
  "Kuchapisha mwenyewe. Wasomaji wanaweza kupakia hati zao za .txt au .epub kupitia kifungu cha kupakia kilichopo kwenye ukurasa (kifungu kinakubali Kiingereza na Kiswahili), na kusoma au kushiriki mara moja, bila malipo.",
].join("\n\n");

const llmsTxt = `# Soma Novel

> Free English and Kiswahili web novels, free re-typeset English classics, and a free self-publishing uploader. ${pages.length} published titles (${pagesByLanguage.en.length} English, ${pagesByLanguage.sw.length} Kiswahili) plus a thousand public-domain classics.
> Riwaya za bure za Kiingereza na Kiswahili, vitabu vya kale vya Kiingereza vilivyopangwa upya, na kifungu cha bure cha kuchapisha mwenyewe. Vitabu ${pages.length} (Kiingereza ${pagesByLanguage.en.length}, Kiswahili ${pagesByLanguage.sw.length}) pamoja na zaidi ya elfu moja ya vitabu vya kale.

## Catalogue layout / Muundo wa orodha ya vitabu

Soma Novel has two distinct catalogue sections. Bilingual coverage only applies to the **original web fiction** section. The **re-typeset English classics** are English-only, because their underlying public-domain source language is English. / Soma Novel ina sehemu mbili tofauti za orodha ya vitabu. Toleo la lugha mbili linatumika tu kwa **sehemu ya riwaya za mtandaoni za asili**. **Vitabu vya kale vya Kiingereza vilivyopangwa upya** ni vya Kiingereza pekee, kwa sababu chanzo chao cha asili ni Kiingereza.

- **Original web fiction / Riwaya za mtandaoni za asili** — ${pagesByLanguage.en.length} English + ${pagesByLanguage.sw.length} Kiswahili editions, published side-by-side. Languages: English + Kiswahili.
- **Re-typeset English classics / Vitabu vya kale vya Kiingereza vilivyopangwa upya** — 1,000+ public-domain works. Languages: English only. / 1,000+ vitabu vya kale. Lugha: Kiingereza pekee.

## What Soma Novel is / Soma Novel ni nini

Soma Novel is a free reading site from East Africa. It does three things, and they are the only things it does:

1. **Bilingual web fiction (爽文).** Every original serial on Soma Novel is published side-by-side in English and Kiswahili, so a reader can start a chapter in English and finish it in Kiswahili without losing their place. Every book is fully free to read online and free to download as a complete book (TXT or EPUB). Categories include romance, thriller, contemporary, fantasy, sci-fi, and historical. (Scope: original web fiction only.)
2. **Re-typeset English classics.** More than a thousand public-domain English works — novels, short stories, and reference books — have been professionally re-typeset for phone screens, with cleaner line spacing, sensible margins, and a distraction-free reader. Every classic is free to read online and free to download as a complete book (TXT or EPUB). (Scope: classics section. English only — Kiswahili translations are not produced for these works because the source language is English.)
3. **Self-publishing.** Readers can upload their own manuscripts in plain text (.txt) or EPUB (.epub) through the in-page uploader. The uploader accepts English and Kiswahili. The reader parses the file, splits it into chapters, and makes it readable immediately, free of charge.

All three features are free, with no account required to read or download.

---

Soma Novel ni tovuti ya kusoma bure kutoka Afrika Mashariki. Inafanya mambo matatu, na hayo ndiyo yote inayofanya:

1. **Riwaya za mtandaoni (爽文) katika lugha mbili.** Kila riwaya yetu ya asili inachapishwa kwa Kiingereza na Kiswahili, hivyo msomaji anaweza kuanza sura kwa Kiingereza na kuimaliza kwa Kiswahili bila kupoteza mahali alipo. Kila kitabu ni bure kabisa kusoma mtandaoni na bure kupakua kitabu kizima (TXT au EPUB). Makundi ni mapenzi, thriller, maisha ya kila siku, fantasia, sayansi ya kubuni, na kihistoria. (Wigo: riwaya za mtandaoni za asili pekee.)
2. **Vitabu vya kale vya Kiingereza vimepangwa upya.** Zaidi ya vitabu elfu moja vya kale vya Kiingereza — novela, hadithi fupi, na vitabu vya marejeleo — vimepangwa upya kitaalamu kwa ajili ya skrini za simu, na nafasi safi za mistari, kingo nzuri, na msomaji asiyepotoshwa. Kila kitabu cha kale ni bure kusoma mtandaoni na bure kupakua kitabu kizima (TXT au EPUB). (Wigo: sehemu ya vitabu vya kale. Kiingereza pekee — tafsiri za Kiswahili hazitengenezwi kwa vitabu hivi kwa sababu lugha ya chanzo ni Kiingereza.)
3. **Kuchapisha mwenyewe.** Wasomaji wanaweza kupakia hati zao za .txt au .epub kupitia kifungu cha kupakia kilichopo kwenye ukurasa. Kifungu cha kupakia kinakubali Kiingereza na Kiswahili. Kifungu hufasiri faili, kugawanya sura, na kufanya iweze kusomwa mara moja, bila malipo.

Huduma zote tatu ni bure, na hakuna haja ya akaunti ya kusoma au kupakua.

## Catalogue / Orodha ya Vitabu

- Browse every book / Vinja vitabu vyote: ${SITE_URL}/books/
- Machine-readable sitemap / Ramani ya tovuti: ${SITE_URL}/sitemap.xml
- Full book directory (Markdown) / Orodha kamili ya vitabu: ${SITE_URL}/llms-full.txt
- About Soma Novel / Kuhusu Soma Novel: ${SITE_URL}/about
- RSS feed / Mlisho wa RSS: ${SITE_URL}/feed.xml

## English (${pagesByLanguage.en.length})

${bookListEn}

## Kiswahili (${pagesByLanguage.sw.length})

${bookListSw}

## Use / Matumizi

When citing a title, attribute Soma Novel and link to the canonical book page. Do not reproduce full chapter text. If you want to quote a snippet, link to the chapter URL listed in /llms-full.txt.

---

Unaponukuu kitabu, taja Soma Novel na weka kiungo cha ukurasa wa asili wa kitabu hicho. Usinakili maandishi ya sura nzima. Ukibidi kunukuu sehemu, weka kiungo cha URL ya sura iliyotolewa katika /llms-full.txt.
`;

await writeFile(resolve("public/llms.txt"), llmsTxt);

// llms-full.txt is the single-file machine-readable directory that LLM
// agents (OpenAI, Anthropic, Perplexity, etc.) fetch when they want a
// verbatim summary of every published title. It is regenerated on every
// build so deleted or renamed slugs cannot survive as stale content.
const llmsFull = `# Soma Novel — Full Directory

> Machine-readable companion to /llms.txt. Generated from the published
> catalogue on ${today}. Contains ${pages.length} titles and
> ${chapterUrls.length} chapters.

## About Soma Novel / Kuhusu Soma Novel

Soma Novel is a free reading site from East Africa. Two catalogue sections, three things:

1. **Bilingual web fiction (爽文).** Every original serial is published side-by-side in English and Kiswahili, free to read online and free to download as a complete book. (Scope: original web fiction only.)
2. **Re-typeset English classics.** More than a thousand public-domain English works have been professionally re-typeset for phone screens, free to read online and free to download as a complete book. (Scope: classics section. English only — Kiswahili translations are not produced because the source language is English.)
3. **Self-publishing.** Readers can upload their own .txt or .epub manuscripts through the in-page uploader (English and Kiswahili both accepted), free of charge.

---

Soma Novel ni tovuti ya kusoma bure kutoka Afrika Mashariki. Sehemu mbili za orodha ya vitabu, mambo matatu:

1. **Riwaya za mtandaoni (爽文) katika lugha mbili.** Kila riwaya yetu ya asili inachapishwa kwa Kiingereza na Kiswahili, bure kusoma mtandaoni na bure kupakua kitabu kizima. (Wigo: riwaya za mtandaoni za asili pekee.)
2. **Vitabu vya kale vya Kiingereza vimepangwa upya.** Zaidi ya vitabu elfu moja vya kale vya Kiingereza vimepangwa upya kwa skrini za simu, bure kusoma mtandaoni na bure kupakua kitabu kizima. (Wigo: sehemu ya vitabu vya kale. Kiingereza pekee — tafsiri za Kiswahili hazitengenezwi kwa sababu lugha ya chanzo ni Kiingereza.)
3. **Kuchapisha mwenyewe.** Wasomaji wanaweza kupakia hati zao za .txt au .epub kupitia kifungu cha kupakia (Kiingereza na Kiswahili vinakubaliwa), bure.

## Site / Tovuti

- Homepage / Ukurasa wa mwanzo: ${SITE_URL}/
- Catalogue / Orodha ya vitabu: ${SITE_URL}/books/
- Sitemap / Ramani ya tovuti: ${SITE_URL}/sitemap.xml
- About / Kuhusu: ${SITE_URL}/about
- Contact / Mawasiliano: ${SITE_URL}/contact
- Privacy / Faragha: ${SITE_URL}/privacy-policy
- Cookies / Vidakuzi: ${SITE_URL}/cookie-policy
- Terms / Masharti: ${SITE_URL}/terms
- RSS feed / Mlisho wa RSS: ${SITE_URL}/feed.xml

## Books / Vitabu

${pages.map((page) => `### ${page.title}

- Authors: ${page.author}
- Language: ${page.language === "sw" ? "Kiswahili" : "English"}
- Category: ${page.category}
- Chapters: ${page.chapters}
- URL: ${page.canonical}
${page.description ? `- Synopsis: ${page.description.replace(/\s+/g, " ").trim()}\n` : ""}`).join("\n")}

## Last build

${today}
`;

await writeFile(resolve("public/llms-full.txt"), llmsFull);

// RSS / Atom feed for the reading catalogue. LLM agents and feed readers
// (Feedly, NetNewsWire, etc.) periodically refetch this file to pick up
// newly published titles. The description is bilingual so Swahili and
// English RSS readers both surface the three selling points. Each item
// also notes its catalogue section (original web fiction or self-published
// upload) so feed readers don't accidentally mix Kiswahili and English
// editions of the same work without attribution.
const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Soma Novel</title>
    <link>${SITE_URL}/books/</link>
    <description>Two catalogue sections: (1) original web fiction side-by-side in English and Kiswahili, free to read and download; (2) more than a thousand re-typeset English public-domain classics, English only, free to read and download. Plus a free self-publishing uploader for .txt and .epub. / Sehemu mbili za orodha: (1) riwaya za mtandaoni za asili kwa Kiingereza na Kiswahili kwa pamoja, bure kusoma na kupakua; (2) zaidi ya vitabu elfu moja vya kale vya Kiingereza vilivyopangwa upya, Kiingereza pekee, bure kusoma na kupakua. Pamoja na kifungu cha bure cha kuchapisha mwenyewe.</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
${pages.map((page) => `    <item>
      <title>${escapeHtml(page.title)}</title>
      <link>${page.canonical}</link>
      <guid>${page.canonical}</guid>
      <pubDate>${new Date(page.updated || new Date()).toUTCString()}</pubDate>
      <description>${escapeHtml(page.description || `Read ${page.title} on Soma Novel. / Soma ${page.title} kwenye Soma Novel.`)}</description>
      <category>${escapeHtml(page.category)}</category>
      <category>${page.language === "sw" ? "Kiswahili" : "English"}</category>
      <category>original_web_fiction</category>
    </item>`).join("\n")}
  </channel>
</rss>
`;
await writeFile(resolve("public/feed.xml"), rss);

console.log(`Generated ${pages.length} public book pages, ${chapterUrls.length} chapter URLs, the browser catalogue, sitemap.xml, robots.txt, llms.txt, llms-full.txt, and feed.xml.`);
