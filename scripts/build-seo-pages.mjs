import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const SITE_URL = "https://somanovel.uk";
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "contact@somanovel.uk";
const source = await readFile(resolve("src/lib/supabase-books.ts"), "utf8");
const sourceValue = (constant) => source.match(new RegExp(`const ${constant} =[^']*'([^']+)'`))?.[1];
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || sourceValue("SUPABASE_URL");
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || sourceValue("SUPABASE_ANON_KEY");
const output = resolve("public/books");
const publicCatalogueOutput = resolve("public/catalog/books.json");
const homeIndexPath = resolve("index.html");

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error("Supabase public configuration is required to build SEO pages.");

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
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!response.ok) throw new Error(`Supabase SEO query failed (${response.status}).`);
  return response.json();
}

const booksQuery = new URLSearchParams({
  select: "id,parent_book_id,slug,title,author_name,description,cover_url,language_code,category,tags,total_chapters,is_featured,published_at,created_at,updated_at",
  status: "eq.published",
  or: `(published_at.is.null,published_at.lte.${new Date().toISOString()})`,
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
const pages = [];

for (const book of books) {
  const chaptersQuery = new URLSearchParams({
    select: "chapter_number,title,word_count",
    book_id: `eq.${book.id}`,
    status: "eq.published",
    order: "chapter_number.asc",
  });
  const chapters = await fetchRows(`chapters?${chaptersQuery}`);
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
  const html = `<!doctype html>
<html lang="${book.language_code === "sw" ? "sw" : "en"}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(book.title)} | Soma Novel</title>
  <meta name="description" content="${escapeHtml(book.description || `Read ${book.title} on Soma Novel.`)}">
  <link rel="canonical" href="${canonical}">
  <meta name="robots" content="index,follow,max-image-preview:large">
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
  pages.push({ canonical, title: book.title, updated: book.updated_at || book.published_at });
}

const catalogue = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>English & Kiswahili Web Novels | Soma Novel</title><meta name="description" content="Browse free English and Kiswahili web novels from East Africa on Soma Novel."><link rel="canonical" href="${SITE_URL}/books/"><meta name="robots" content="index,follow"><style>body{max-width:860px;margin:0 auto;padding:32px 20px;font:17px/1.6 system-ui,sans-serif;background:#f8f7f2;color:#102321}a{color:#9e3c19}li{margin:12px 0}</style></head><body><nav><a href="/">Soma Novel</a></nav><h1>English & Kiswahili Web Novels</h1><p>Free stories from East Africa, available in English and Kiswahili.</p><ul>${pages.map((page) => `<li><a href="${page.canonical.replace(SITE_URL, "")}">${escapeHtml(page.title)}</a></li>`).join("\n")}</ul>${legalFooter}</body></html>`;
await writeFile(resolve(output, "index.html"), catalogue);

const today = new Date().toISOString().slice(0, 10);
const urls = [`${SITE_URL}/`, `${SITE_URL}/books/`, ...pages.map((page) => page.canonical)];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${url}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>${url === `${SITE_URL}/` ? "1.0" : "0.8"}</priority></url>`).join("\n")}\n</urlset>\n`;
await writeFile(resolve("public/sitemap.xml"), sitemap);
await writeFile(resolve("public/robots.txt"), `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\n\n# Allow search and answer engines, but do not grant model-training crawlers access.\nUser-agent: OAI-SearchBot\nAllow: /\n\nUser-agent: ChatGPT-User\nAllow: /\n\nUser-agent: Googlebot\nAllow: /\n\nUser-agent: GPTBot\nDisallow: /\n\nUser-agent: Google-Extended\nDisallow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
await writeFile(resolve("public/llms.txt"), `# Soma Novel\n\n> Free English and Kiswahili web novels from East Africa.\n\nSoma Novel publishes original web fiction in English and Kiswahili. Book details and chapter lists are available as public HTML pages under /books/.\n\n## Catalogue\n\n- ${SITE_URL}/books/\n- ${SITE_URL}/sitemap.xml\n\n## Use\n\nPlease attribute Soma Novel and link to the canonical book page when citing a title or synopsis. Do not reproduce full chapter text.\n`);
console.log(`Generated ${pages.length} public book pages, the browser catalogue, sitemap.xml, robots.txt, and llms.txt.`);
