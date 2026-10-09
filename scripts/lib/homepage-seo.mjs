import { readFile, writeFile } from "node:fs/promises";

const START = "<!-- HOME_FEATURED_PRELOAD_START -->";
const END = "<!-- HOME_FEATURED_PRELOAD_END -->";

function escapeHtml(text) {
  return String(text).replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;");
}
export function patchHomepageHtml(html, data) {
  if (!data || data.schemaVersion !== 1 || !Number.isSafeInteger(data.classicCount) ||
      data.classicCount < 0 || (data.featuredCover !== null &&
      (typeof data.featuredCover !== "string" || !data.featuredCover.startsWith("https://")))) {
    throw new Error("Invalid home-seo schema");
  }
  const count = Number(data.classicCount).toLocaleString("en-US");
  // Dynamic fragments ONLY; leave all Vite-generated script/style URL hashes intact.
  const first = html.indexOf(START), last = html.indexOf(END);
  if (first < 0 || last < first || html.indexOf(START,first+1) >= 0 || html.indexOf(END,last+1) >= 0) {
    throw new Error("F10_HOME_PATCH_NOT_SAFE: missing or duplicate homepage preload anchors");
  }
  const preload = data.featuredCover ?
    START + '\n    <link rel="preconnect" href="' + escapeHtml(new URL(data.featuredCover).origin) +
    '" crossorigin />\n    <link rel="preload" as="image" href="' + escapeHtml(data.featuredCover) +
    '" fetchpriority="high" />\n    ' + END :
    START + "\n    <!-- No English modern cover is available to preload. -->\n    " + END;
  let result = html.slice(0,first) + preload + html.slice(last+END.length);
  // The original source contains both literal numeric counts and legacy
  // English/Swahili prose; normalize the known content-specific expressions.
  const rules = [
    [/\b\d{1,3}(?:,\d{3})* professionally re-typeset English classics/g, count + " professionally re-typeset English classics"],
    [/(?:more than a thousand|Over a thousand|a thousand) public-domain English classics/g, count + " public-domain English classics"],
    [/\b\d{1,3}(?:,\d{3})* public-domain English classics/g, count + " public-domain English classics"],
    [/(?:zaidi ya vitabu elfu moja vya kale vya Kiingereza vilivyopangwa upya|vitabu \d{1,3}(?:,\d{3})* vya kale vya Kiingereza vilivyopangwa upya)/gi, "vitabu " + count + " vya kale vya Kiingereza vilivyopangwa upya"],
    [/(?:Zaidi ya vitabu elfu moja vya kale vya Kiingereza)/g, "Vitabu " + count + " vya kale vya Kiingereza"],
  ];
  for (const [pattern, replacement] of rules) result = result.replace(pattern, replacement);
  if (!result.includes(END) || !result.includes(START) || result.includes("/src/main.tsx")) {
    throw new Error("F10_HOME_PATCH_NOT_SAFE: malformed built homepage");
  }
  return result;
}
export async function patchBuiltHomepage(htmlPath, dataPath) {
  const data = JSON.parse(await readFile(dataPath,"utf8"));
  const original = await readFile(htmlPath, "utf8");
  const updated = patchHomepageHtml(original, data);
  if (updated !== original) await writeFile(htmlPath, updated);
  return { patched: updated !== original, bytes: Buffer.byteLength(updated) };
}
