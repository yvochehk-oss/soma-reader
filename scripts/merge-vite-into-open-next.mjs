import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

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

/classics/*
  Cache-Control: public, max-age=31536000, immutable

/covers/*
  Cache-Control: public, max-age=31536000, immutable

/catalog/*
  Cache-Control: public, max-age=300, must-revalidate
`;

await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true, force: true });
await Promise.all([
  rm(resolve(target, "server.cjs"), { force: true }),
  rm(resolve(target, "server.cjs.map"), { force: true }),
  writeFile(resolve(target, "_headers"), securityHeaders, "utf8"),
]);

// OpenNext invokes the Worker before the static-assets router. Explicitly hand
// the Vite reader shell and its public files back to the ASSETS binding while
// leaving Next.js pages and APIs on the OpenNext handler.
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
                ["/ads.txt", "/feed.xml", "/icon.svg", "/llms-full.txt", "/llms.txt", "/robots.txt", "/sitemap.xml", "/sw.js", "/BingSiteAuth.xml", "/543bfd3d2c6d4bdfeb40e179dd025ec4.txt"].includes(url.pathname);
            if (viteAssetRequest) {
                return env.ASSETS.fetch(request);
            }
`;
const assetRoutingPattern = / {12}const url = new URL\(request\.url\);[\s\S]*?if \(viteAssetRequest\) \{\n {16}return env\.ASSETS\.fetch\(request\);\n {12}\}\n/;

if (assetRoutingPattern.test(workerSource)) {
  await writeFile(workerPath, workerSource.replace(assetRoutingPattern, assetRouting), "utf8");
} else if (workerSource.includes(routeAnchor)) {
  await writeFile(workerPath, workerSource.replace(routeAnchor, assetRouting), "utf8");
} else {
  throw new Error("Could not find the OpenNext URL-routing anchor; refusing to publish an unpatched reader shell.");
}
console.log(`Merged browser-safe Vite assets from ${source} into ${target}.`);
