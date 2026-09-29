const SITE_URL = "https://somanovel.uk";

const escapeHtml = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function safeJson(value) {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function assertBookSlug(slug) {
  if (typeof slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`Invalid published book slug for static reader: ${String(slug)}`);
  }
}

function chapterPath(slug, number) {
  return `/read/${encodeURIComponent(slug)}/${number}`;
}

function readerPath(slug, number) {
  return `/read/${encodeURIComponent(slug)}/${number}`;
}

export function staticReaderHtmlRelativePath(slug, number) {
  assertBookSlug(slug);
  const chapterNumber = Number(number);
  if (!Number.isSafeInteger(chapterNumber) || chapterNumber < 1) {
    throw new Error(`${slug}: invalid chapter number ${String(number)} for static reader path.`);
  }
  return `${slug}/${chapterNumber}.html`;
}

function splitParagraphs(content) {
  return String(content ?? "").split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
}

function wordCount(chapter, paragraphs) {
  const value = Number(chapter.word_count);
  if (Number.isFinite(value) && value >= 0) return value;
  return paragraphs.join(" ").split(/\s+/).filter(Boolean).length;
}

function normalizeBook(book, totalChapters) {
  return {
    slug: book.slug,
    title: String(book.title ?? ""),
    author: String(book.author_name ?? book.author ?? "Soma Originals"),
    language: book.language_code === "sw" || book.language === "sw" ? "sw" : "en",
    coverUrl: String(book.cover_url ?? book.coverUrl ?? ""),
    totalChapters,
  };
}

export function buildReaderArtifacts(book, chapters) {
  assertBookSlug(book.slug);
  const ordered = [...chapters].sort((left, right) => Number(left.chapter_number ?? left.number) - Number(right.chapter_number ?? right.number));
  const numbers = new Set();
  for (const chapter of ordered) {
    const number = Number(chapter.chapter_number ?? chapter.number);
    if (!Number.isInteger(number) || number < 1) throw new Error(`${book.slug}: invalid chapter number ${String(number)}.`);
    if (numbers.has(number)) throw new Error(`${book.slug}: duplicate chapter number ${number}.`);
    numbers.add(number);
    if (!String(chapter.content ?? "").trim()) throw new Error(`${book.slug} chapter ${number}: published body is empty.`);
  }

  const bookData = normalizeBook(book, ordered.length);
  const manifest = {
    schemaVersion: 1,
    book: bookData,
    chapters: ordered.map((chapter) => {
      const number = Number(chapter.chapter_number ?? chapter.number);
      const paragraphs = splitParagraphs(chapter.content);
      return {
        id: String(chapter.id ?? ""),
        number,
        title: String(chapter.title ?? `Chapter ${number}`),
        wordCount: wordCount(chapter, paragraphs),
        url: chapterPath(book.slug, number),
      };
    }),
  };

  return { book: bookData, chapters: ordered, manifest };
}

function consentMarkup(language) {
  const copy = language === "sw"
    ? {
      title: "Mipangilio ya vidakuzi",
      text: "Tunatumia hifadhi muhimu kwa lugha, kuingia na kusoma. Ukiidhinisha, Google AdSense inaweza kutumia vidakuzi vya matangazo. Soma",
      reject: "Kataa matangazo yaliyobinafsishwa",
      accept: "Kubali vidakuzi vya matangazo",
      settings: "Mipangilio ya vidakuzi",
    }
    : {
      title: "Cookie settings",
      text: "We use necessary storage for language, sign-in, and reading. With your permission, Google AdSense may use advertising cookies. Read our",
      reject: "Reject advertising cookies",
      accept: "Accept advertising cookies",
      settings: "Cookie settings",
    };
  return `<section class="cookie-consent" data-reader-consent role="dialog" aria-modal="false" aria-labelledby="reader-consent-title" hidden>
      <div><p class="cookie-consent-title" id="reader-consent-title">${escapeHtml(copy.title)}</p>
      <p class="cookie-consent-copy">${escapeHtml(copy.text)} <a href="/cookie-policy">${language === "sw" ? "Sera ya Vidakuzi" : "Cookie Policy"}</a>.</p></div>
      <div class="reader-consent-actions"><button type="button" data-reader-consent-reject>${escapeHtml(copy.reject)}</button><button type="button" data-reader-consent-accept>${escapeHtml(copy.accept)}</button></div>
    </section>
    <button type="button" class="reader-cookie-settings" data-reader-consent-settings>${escapeHtml(copy.settings)}</button>`;
}

export function renderStaticReaderPage({ book, chapter, previousChapter, nextChapter, siteUrl = SITE_URL }) {
  assertBookSlug(book.slug);
  const number = Number(chapter.chapter_number ?? chapter.number);
  const title = String(chapter.title ?? `Chapter ${number}`);
  const paragraphs = splitParagraphs(chapter.content);
  if (!Number.isInteger(number) || number < 1 || paragraphs.length === 0) {
    throw new Error(`${book.slug}: cannot render empty/invalid chapter ${String(number)}.`);
  }
  const language = book.language_code === "sw" || book.language === "sw" ? "sw" : "en";
  const bookTitle = String(book.title ?? "");
  const author = String(book.author_name ?? book.author ?? "Soma Originals");
  const canonical = `${siteUrl}${readerPath(book.slug, number)}`;
  const bookHref = `/books/${encodeURIComponent(book.slug)}/`;
  const previousNumber = previousChapter ? Number(previousChapter.chapter_number ?? previousChapter.number) : undefined;
  const nextNumber = nextChapter ? Number(nextChapter.chapter_number ?? nextChapter.number) : undefined;
  const previousUrl = previousNumber ? readerPath(book.slug, previousNumber) : "";
  const nextUrl = nextNumber ? readerPath(book.slug, nextNumber) : bookHref;
  const manifestUrl = `/reader-data/${encodeURIComponent(book.slug)}/manifest.json`;
  const coverUrl = String(book.cover_url ?? book.coverUrl ?? "");
  const description = paragraphs[0].replace(/\s+/g, " ").slice(0, 320);
  const chapterLabel = language === "sw" ? `Sura ya ${String(number).padStart(2, "0")}` : `Chapter ${String(number).padStart(2, "0")}`;
  const chapterHeading = `${bookTitle} — ${title}`;
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": canonical,
    headline: `${bookTitle} — Chapter ${number}: ${title}`,
    description,
    inLanguage: language,
    isPartOf: {
      "@type": "Book",
      "@id": `${siteUrl}/books/${encodeURIComponent(book.slug)}/`,
      name: bookTitle,
      author: { "@type": "Person", name: author },
      inLanguage: language,
    },
    author: { "@type": "Person", name: author },
    publisher: { "@type": "Organization", name: "Soma Novel", url: siteUrl },
    url: canonical,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    position: number,
    wordCount: wordCount(chapter, paragraphs),
  };
  const prevLinkText = language === "sw" ? "← Sura iliyotangulia" : "← Previous chapter";
  const nextLinkText = language === "sw" ? "Sura inayofuata →" : "Next chapter →";
  const backLinkText = language === "sw" ? "Rudi kwenye kitabu" : "Back to book";
  const downloadLabel = language === "sw" ? "Pakua sura hii" : "Download this chapter";
  const download10 = language === "sw" ? "Pakua sura 10 zijazo" : "Download next 10 chapters";
  const download20 = language === "sw" ? "Pakua sura 20 zijazo" : "Download next 20 chapters";
  const readerContent = paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("\n");
  const coverMeta = coverUrl ? `<meta property="og:image" content="${escapeHtml(coverUrl)}">` : "";

  return `<!doctype html>
<html lang="${language}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(chapterHeading)} | Soma Novel</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta name="robots" content="index,follow,max-image-preview:large">
  <meta name="google-adsense-account" content="ca-pub-6785168010810140">
  <meta name="google-adsense-platform-account" content="ca-pub-6785168010810140">
  <meta name="google-adsense-platform-domain" content="somanovel.uk">
  <meta property="og:type" content="article"><meta property="og:site_name" content="Soma Novel">
  <meta property="og:title" content="${escapeHtml(chapterHeading)}"><meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">${coverMeta}
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">${safeJson(schema)}</script>
  <link rel="stylesheet" href="/reader-static.css">
  <script defer src="/reader-static.js"></script>
</head>
<body>
  <div class="reader-page reader-theme-sepia" style="--reader-size:20px;--reader-line-height:1.95" data-reader
    data-book-slug="${escapeHtml(book.slug)}" data-book-id="${escapeHtml(book.id ?? "")}" data-chapter-id="${escapeHtml(chapter.id ?? "")}"
    data-chapter-number="${number}" data-language="${language}" data-title="${escapeHtml(bookTitle)}" data-author="${escapeHtml(author)}"
    data-cover-url="${escapeHtml(coverUrl)}" data-manifest-url="${manifestUrl}"
    data-previous-url="${previousUrl}" data-next-url="${nextUrl}">
    <nav class="reader-top" aria-label="${language === "sw" ? "Urambazaji wa msomaji" : "Reader navigation"}">
      <a href="${bookHref}" data-reader-back>${escapeHtml(backLinkText)}</a>
      <a href="${bookHref}" class="reader-title">${escapeHtml(bookTitle)}</a><button type="button" class="reader-settings" data-reader-settings-toggle aria-label="${language === "sw" ? "Mipangilio ya kusoma" : "Reading settings"}">Aa</button>
    </nav>
    <main class="reader-main">
      <div class="offline-note" data-offline-status>${language === "sw" ? "✓ Sura hii iko tayari kwa kusoma bila mtandao." : "✓ This chapter is ready for offline reading."}</div>
      <span class="reader-chapter-label">${chapterLabel}</span>
      <h1>${escapeHtml(title)}</h1>
      <article class="reader-body" data-reader-content>${readerContent}</article>
      <div class="reader-ad" aria-label="Advertisement"><ins class="adsbygoogle" style="display:block" data-ad-format="fluid" data-ad-client="ca-pub-6785168010810140" data-ad-slot="1159270041" data-full-width-responsive="true"></ins></div>
      <nav class="reader-footer" aria-label="${language === "sw" ? "Sura" : "Chapters"}">
        ${previousUrl ? `<a href="${previousUrl}" data-reader-turn-link="previous">${escapeHtml(prevLinkText)}</a>` : `<a href="${bookHref}">${escapeHtml(backLinkText)}</a>`}
        ${nextNumber ? `<a href="${nextUrl}" data-reader-turn-link="next">${escapeHtml(nextLinkText)}</a>` : `<a href="${bookHref}">${escapeHtml(backLinkText)}</a>`}
      </nav>
    </main>
    <section class="reader-controls" data-reader-controls aria-label="${language === "sw" ? "Mipangilio ya kusoma" : "Reading settings"}" hidden>
      <div class="reader-control-group"><span>${language === "sw" ? "Ukubwa wa maandishi" : "Text size"}</span><button type="button" data-reader-font-decrease aria-label="${language === "sw" ? "Punguza maandishi" : "Decrease text size"}">A−</button><button type="button" data-reader-font-increase aria-label="${language === "sw" ? "Ongeza maandishi" : "Increase text size"}">A+</button></div>
      <div class="reader-control-group"><span>${language === "sw" ? "Nafasi ya mistari" : "Line spacing"}</span><button type="button" data-reader-line-height>1.95</button></div>
      <div class="reader-control-group"><span>${language === "sw" ? "Mandhari" : "Theme"}</span><button type="button" data-reader-theme="light">${language === "sw" ? "Nyeupe" : "Light"}</button><button type="button" data-reader-theme="sepia">${language === "sw" ? "Krimu" : "Sepia"}</button><button type="button" data-reader-theme="dark">${language === "sw" ? "Giza" : "Dark"}</button></div>
      <div class="reader-control-group"><button type="button" data-reader-fullscreen>${language === "sw" ? "Skrini nzima" : "Full screen"}</button><button type="button" data-reader-download="1">${escapeHtml(downloadLabel)}</button><button type="button" data-reader-download="10">${escapeHtml(download10)}</button><button type="button" data-reader-download="20">${escapeHtml(download20)}</button></div>
      <p class="reader-control-note" data-reader-status role="status" aria-live="polite"></p>
    </section>
    <div class="reader-mobile-toolbar" data-reader-toolbar aria-label="${language === "sw" ? "Mipangilio ya kusoma" : "Reading settings"}">
      <button type="button" data-reader-turn="previous" aria-label="${language === "sw" ? "Sura iliyotangulia" : "Previous chapter"}"${previousUrl ? "" : " disabled"}>‹</button>
      <label class="reader-progress"><span data-reader-progress-text>${String(number).padStart(2, "0")} · 0%</span><input type="range" min="0" max="100" value="0" data-reader-progress aria-label="${language === "sw" ? "Maendeleo ya kusoma" : "Reading progress"}"></label>
      <button type="button" data-reader-turn="next" aria-label="${language === "sw" ? "Sura inayofuata" : "Next chapter"}"${nextNumber ? "" : " disabled"}>›</button>
      <button type="button" data-reader-settings-toggle aria-label="${language === "sw" ? "Mipangilio ya kusoma" : "Reading settings"}">Aa</button>
    </div>
    ${consentMarkup(language)}
  </div>
  <footer class="reader-site-footer"><a href="/privacy-policy">${language === "sw" ? "Sera ya Faragha" : "Privacy Policy"}</a> · <a href="/cookie-policy">${language === "sw" ? "Sera ya Vidakuzi" : "Cookie Policy"}</a> · <a href="/terms">${language === "sw" ? "Masharti ya Huduma" : "Terms of Service"}</a></footer>
</body>
</html>`;
}

