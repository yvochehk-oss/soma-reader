const EN_UNITS = new Map([
  ["one", 1], ["two", 2], ["three", 3], ["four", 4], ["five", 5],
  ["six", 6], ["seven", 7], ["eight", 8], ["nine", 9], ["ten", 10],
  ["eleven", 11], ["twelve", 12], ["thirteen", 13], ["fourteen", 14],
  ["fifteen", 15], ["sixteen", 16], ["seventeen", 17], ["eighteen", 18],
  ["nineteen", 19],
]);

const EN_TENS = new Map([
  ["twenty", 20], ["thirty", 30], ["forty", 40], ["fifty", 50],
  ["sixty", 60], ["seventy", 70], ["eighty", 80], ["ninety", 90],
]);

const SW_UNITS = new Map([
  ["kwanza", 1], ["moja", 1], ["pili", 2], ["mbili", 2], ["tatu", 3],
  ["nne", 4], ["tano", 5], ["sita", 6], ["saba", 7], ["nane", 8],
  ["tisa", 9], ["kumi", 10],
]);

const SW_TENS = new Map([
  ["ishirini", 20], ["thelathini", 30], ["arobaini", 40], ["hamsini", 50],
  ["sitini", 60], ["sabini", 70], ["themanini", 80], ["themanini", 80],
  ["tisini", 90],
]);

function normalizedWords(value) {
  return value.toLowerCase().replace(/[-–—]/g, " ").replace(/\s+/g, " ").trim();
}

export function chapterNumber(value, language) {
  const normalized = normalizedWords(value);
  if (/^\d+$/.test(normalized)) return Number(normalized);
  if (language === "en") {
    if (EN_UNITS.has(normalized)) return EN_UNITS.get(normalized);
    const words = normalized.split(" ");
    if (words.length === 2 && EN_TENS.has(words[0]) && EN_UNITS.has(words[1])) return EN_TENS.get(words[0]) + EN_UNITS.get(words[1]);
    if (EN_TENS.has(normalized)) return EN_TENS.get(normalized);
    if (normalized === "one hundred") return 100;
    return null;
  }

  if (SW_UNITS.has(normalized)) return SW_UNITS.get(normalized);
  if (SW_TENS.has(normalized)) return SW_TENS.get(normalized);
  const compound = /^(kumi|ishirini|thelathini|arobaini|hamsini|sitini|sabini|themanini|tisini)\s+na\s+(moja|mbili|tatu|nne|tano|sita|saba|nane|tisa)$/.exec(normalized);
  if (compound) {
    const tens = compound[1] === "kumi" ? 10 : SW_TENS.get(compound[1]);
    return tens + SW_UNITS.get(compound[2]);
  }
  if (normalized === "mia moja") return 100;
  return null;
}

function parseHeading(line) {
  const match = /^(?:(#{1,6})\s+)?(Chapter|Sura(?:\s+ya)?)\s+(.+?)\s*$/i.exec(line.trim());
  if (!match) return null;
  const language = /^chapter$/i.test(match[2]) ? "en" : "sw";
  const remainder = match[3].trim();
  const separator = remainder.search(/\s*[:：]\s*/);
  let numberText = separator >= 0 ? remainder.slice(0, separator).trim() : remainder;
  let title = separator >= 0 ? remainder.slice(separator).replace(/^\s*[:：]\s*/, "").trim() : "";

  if (separator < 0) {
    const decimal = /^(\d+)\s+(.+)$/.exec(remainder);
    if (decimal) {
      numberText = decimal[1];
      title = decimal[2].trim();
    }
  }

  const number = chapterNumber(numberText, language);
  if (!number || number < 1) return null;
  // Plain-text chapter lines need a colon; Markdown headings may omit it.
  if (!match[1] && separator < 0) return null;
  return { number, title, language };
}

const EXCLUDED_PATH_PART = /(?:^|[_. -])(?:backup|archive|old|publication|pre[_ -]?s\d|mobile[_ .-]?work|reports?|audit|outline|planning|research|design|prompts?|video|\.agent|\.reasonix)(?:$|[_. -])/i;
const BLOCKED_PATH_PART = /(?:禁止发布|隔离|do[_ -]?not[_ -]?publish|写作中转)/i;

export function isExcludedManuscriptPath(path) {
  return String(path).split(/[\\/]+/).some((part) => /^(?:\..+\.mobile_work|mobile_.+_work)$/i.test(part) || EXCLUDED_PATH_PART.test(part) || BLOCKED_PATH_PART.test(part));
}

export function chapterDiagnostics(markdown) {
  const normalized = markdown.replace(/\r\n?/g, "\n");
  const glued = [];
  for (const [index, line] of normalized.split("\n").entries()) {
    const marker = line.search(/#{1,6}\s+(?:Chapter|Sura(?:\s+ya)?)\s+/i);
    if (marker > 0) glued.push(index + 1);
  }
  const chapters = parseChapters(markdown);
  const numbers = chapters.map((chapter) => chapter.number);
  const continuous = numbers.length > 0 && numbers.every((number, index) => number === index + 1) && new Set(numbers).size === numbers.length;
  return { chapters, gluedHeadingLines: glued, continuous };
}

export function assertPublishableChapters(markdown, sourceName = "manuscript") {
  const diagnostic = chapterDiagnostics(markdown);
  if (diagnostic.gluedHeadingLines.length) {
    throw new Error(`${sourceName} has chapter headings glued to prose on line(s) ${diagnostic.gluedHeadingLines.join(", ")}. Put every Chapter/Sura heading on its own line before uploading.`);
  }
  if (!diagnostic.chapters.length) throw new Error(`${sourceName} has no recognizable Chapter/Sura headings.`);
  if (!diagnostic.continuous) {
    throw new Error(`${sourceName} chapter numbers must be unique and continuous from 1. Found: ${diagnostic.chapters.map((chapter) => chapter.number).join(", ")}.`);
  }
  if (diagnostic.chapters.length === 1 && /(?:^|\n).+#{1,6}\s+(?:Chapter|Sura(?:\s+ya)?)\s+/i.test(markdown)) {
    throw new Error(`${sourceName} appears to contain multiple chapters but only one standalone heading was parsed.`);
  }
  return diagnostic.chapters;
}

export function parseChapters(markdown, status = "draft") {
  const body = markdown.replace(/\r\n?/g, "\n").replace(/^---[\s\S]*?---\s*/, "").trim();
  const lines = body.split(/\r?\n/);
  const headings = [];
  let offset = 0;
  for (const line of lines) {
    const parsed = parseHeading(line);
    if (parsed) headings.push({ ...parsed, index: offset, length: line.length });
    offset += line.length + 1;
  }

  return headings.map((heading, index) => {
    const next = headings[index + 1];
    const content = body.slice(heading.index + heading.length, next?.index).trim();
    return {
      number: heading.number,
      title: heading.title || (heading.language === "sw" ? `Sura ya ${heading.number}` : `Chapter ${heading.number}`),
      content,
      status,
      isFree: true,
    };
  }).filter((chapter) => chapter.content);
}

export function inferLanguage(markdown, fileName = "") {
  const lower = fileName.toLowerCase();
  if (/(?:^|[_\-.])en(?:[_\-.]|$)|english/.test(lower)) return "en";
  if (/(?:^|[_\-.])sw(?:[_\-.]|$)|swahili|kiswahili/.test(lower)) return "sw";
  return /^\s*(?:#{1,6}\s+)?Chapter\s+/im.test(markdown) ? "en" : /^\s*(?:#{1,6}\s+)?Sura(?:\s+ya)?\s+/im.test(markdown) ? "sw" : null;
}

export function inferTitle(markdown, fileName) {
  const body = markdown.replace(/\r\n?/g, "\n").replace(/^---[\s\S]*?---\s*/, "");
  const frontMatter = body.split(/^(?:#{1,6}\s+)?(?:Chapter|Sura(?:\s+ya)?)\s+/im, 1)[0];
  const titleHeading = frontMatter.match(/^#\s+([^#\s].*)$/m)?.[1]?.trim();
  if (titleHeading && !/^(?:Chapter|Sura(?:\s+ya)?)\b/i.test(titleHeading)) {
    return titleHeading.toLowerCase().replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
  }
  return fileName
    .replace(/\.(?:md|txt)$/i, "")
    .replace(/^mobile[_ -]+/i, "")
    .replace(/(?:_final)?_(?:en|sw)(?:_final)?(?:_expanded)?(?:_v\d+(?:_\d+)*)?$/i, "")
    .replace(/_TOLEO_LILILOPANULIWA$/i, "")
    .replace(/_/g, " ")
    .replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}

export function inferAuthor(markdown) {
  const body = markdown.replace(/\r\n?/g, "\n").replace(/^---[\s\S]*?---\s*/, "");
  const frontMatter = body.split(/^(?:#{1,6}\s+)?(?:Chapter|Sura(?:\s+ya)?)\s+/im, 1)[0];
  const labelled = frontMatter.match(/^\s*(?:\*{1,2}|_{1,2})?(?:Author|Mwandishi)\s*:\s*(.+?)(?:\*{1,2}|_{1,2})?\s*$/im)?.[1]?.trim();
  if (labelled) return labelled;
  const byline = frontMatter.match(/^##\s+([^#\n]+)$/m)?.[1]?.trim();
  return byline && !/^(?:Chapter|Sura(?:\s+ya)?)\b/i.test(byline) && byline.split(/\s+/).length <= 5 ? byline : null;
}

export function manuscriptScore(fileName) {
  const lower = fileName.toLowerCase();
  if (!/\.(?:md|txt)$/.test(lower)) return -Infinity;
  if (isExcludedManuscriptPath(fileName) || /(report|audit|outline|bible|concept|synopsis|ledger|notes|readme|validation|prompt|narration)/.test(lower)) return -Infinity;
  let score = 0;
  if (/mobile_/.test(lower)) score += 100;
  if (/final/.test(lower)) score += 50;
  if (/(?:_final_(?:en|sw)|_(?:en|sw)_final)/.test(lower)) score += 50;
  if (/full_story/.test(lower)) score += 20;
  if (/chapters?_\d/.test(lower)) score += 5;
  if (/\.md$/.test(lower)) score += 5;
  return score;
}
