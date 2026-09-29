import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { assertCloudflareStaticAssetLimits } from "./lib/cloudflare-static-asset-limits.mjs";

const source = resolve("dist");
const target = resolve(".open-next/assets");
const workerPath = resolve(".open-next/worker.js");
const securityHeaders = `/*
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://pagead2.googlesyndication.com https://*.googlesyndication.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://generativelanguage.googleapis.com; frame-src https://*.googlesyndication.com https://googleads.g.doubleclick.net; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  Referrer-Policy: strict-origin-when-cross-origin
  Strict-Transport-Security: max-age=31536000
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/books/*
  Cache-Control: public, max-age=0, must-revalidate

/read/*
  Cache-Control: public, max-age=0, must-revalidate

/reader-data/*
  Cache-Control: public, max-age=0, must-revalidate

/reader-static.*
  Cache-Control: public, max-age=300, must-revalidate

/classics/*
  Cache-Control: public, max-age=31536000, immutable

/covers/*
  Cache-Control: public, max-age=31536000, immutable

/catalog/*
  Cache-Control: public, max-age=300, must-revalidate
`;

await mkdir(target, { recursive: true });
// Vite's public tree is generated from the currently published database rows.
// Clear only these owned output subtrees first so withdrawn chapters cannot
// survive in a previous OpenNext assets directory after the new build.
await Promise.all([
  rm(resolve(target, "read"), { recursive: true, force: true }),
  rm(resolve(target, "reader-data"), { recursive: true, force: true }),
  rm(resolve(target, "reader-static.js"), { force: true }),
  rm(resolve(target, "reader-static.css"), { force: true }),
]);
await cp(source, target, { recursive: true, force: true });
await Promise.all([
  rm(resolve(target, "server.cjs"), { force: true }),
  rm(resolve(target, "server.cjs.map"), { force: true }),
  writeFile(resolve(target, "_headers"), securityHeaders, "utf8"),
]);
const assetStats = await assertCloudflareStaticAssetLimits(target);
console.log(`Cloudflare ASSETS limit check passed: ${assetStats.files}/${assetStats.limits.maxFiles} files (${assetStats.remainingFiles} file slots remain), ${assetStats.totalBytes} bytes; largest ${assetStats.largestFile?.path ?? "none"} (${assetStats.largestFile?.bytes ?? 0} bytes).`);

// Keep reader paths out of the Next.js handler when an asset is missing. Cloudflare's
// auto-trailing-slash asset handling serves existing `/read/<slug>/<n>.html` files
// directly for their extensionless canonical URLs; this Worker branch is the
// explicit 404 path for missing or malformed chapter URLs.
const workerSource = await readFile(workerPath, "utf8");
const routeAnchor = "            const url = new URL(request.url);\n";
const assetRouting = `${routeAnchor}            const viteAssetRequest =
                url.pathname === "/" ||
                url.pathname === "/index.html" ||
                url.pathname.startsWith("/assets/") ||
                url.pathname.startsWith("/books/") ||
                url.pathname.startsWith("/catalog/") ||
                url.pathname.startsWith("/classics/") ||
                url.pathname.startsWith("/covers/") ||
                url.pathname === "/reader-data" ||
                url.pathname.startsWith("/reader-data/") ||
                ["/ads.txt", "/feed.xml", "/icon.svg", "/llms-full.txt", "/llms.txt", "/robots.txt", "/sitemap.xml", "/sw.js", "/reader-static.js", "/reader-static.css", "/BingSiteAuth.xml", "/543bfd3d2c6d4bdfeb40e179dd025ec4.txt"].includes(url.pathname);
            const isReaderRequest = url.pathname === "/read" || url.pathname.startsWith("/read/");
            if (isReaderRequest) {
                const readerPath = url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : url.pathname;
                const segments = readerPath.split("/");
                const isReaderChapter = segments.length === 4 &&
                    segments[0] === "" &&
                    segments[1] === "read" &&
                    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(segments[2]) &&
                    /^[1-9][0-9]*$/.test(segments[3]);
                if (!isReaderChapter) return new Response("Not Found", { status: 404 });
                if (readerPath !== url.pathname) {
                    const canonicalUrl = new URL(request.url);
                    canonicalUrl.pathname = readerPath;
                    return Response.redirect(canonicalUrl.toString(), 308);
                }
                const readerAssetUrl = new URL(request.url);
                readerAssetUrl.pathname = readerPath + ".html";
                const readerAssetResponse = await env.ASSETS.fetch(new Request(readerAssetUrl.toString(), request));
                if (readerAssetResponse.status === 404) return new Response("Not Found", { status: 404 });
                return readerAssetResponse;
            }
            const isSingleBook = url.pathname === "/book" || url.pathname.startsWith("/book/");
            if (isSingleBook) {
                const rawSlug = url.pathname.startsWith("/book/") ? url.pathname.slice(6) : "";
                const bookSlug = rawSlug.endsWith("/") ? rawSlug.slice(0, -1) : rawSlug;
                const canonicalUrl = new URL(request.url);
                canonicalUrl.pathname = bookSlug ? "/books/" + bookSlug + "/" : "/books/";
                return Response.redirect(canonicalUrl.toString(), 308);
            }
            if (viteAssetRequest) {
                let reqToFetch = request;
                const lastSegment = url.pathname.slice(url.pathname.lastIndexOf("/") + 1);
                if (url.pathname.endsWith("/")) {
                    const indexUrl = new URL(request.url);
                    indexUrl.pathname += "index.html";
                    reqToFetch = new Request(indexUrl.toString(), request);
                } else if (!lastSegment.includes(".")) {
                    const indexUrl = new URL(request.url);
                    indexUrl.pathname += "/index.html";
                    reqToFetch = new Request(indexUrl.toString(), request);
                }
                let assetRes = await env.ASSETS.fetch(reqToFetch);
                if (assetRes.status === 404 && reqToFetch !== request) {
                    assetRes = await env.ASSETS.fetch(request);
                }
                return assetRes;
            }
`;
const assetRoutingPattern = / {12}const url = new URL\(request\.url\);[\s\S]*?if \(viteAssetRequest\) \{[\s\S]*?return (?:env\.ASSETS\.fetch\(request\)|assetRes);\n {12}\}\n/;

if (assetRoutingPattern.test(workerSource)) {
  await writeFile(workerPath, workerSource.replace(assetRoutingPattern, assetRouting), "utf8");
} else if (workerSource.includes(routeAnchor)) {
  await writeFile(workerPath, workerSource.replace(routeAnchor, assetRouting), "utf8");
} else {
  throw new Error("Could not find the OpenNext URL-routing anchor; refusing to publish an unpatched reader shell.");
}
console.log(`Merged browser-safe Vite assets from ${source} into ${target}.`);
