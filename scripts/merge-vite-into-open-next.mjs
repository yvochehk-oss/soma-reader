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
const assetRouting = `${routeAnchor}            const viteAssetRequest =\n                url.pathname === "/" ||\n                url.pathname === "/index.html" ||\n                url.pathname.startsWith("/assets/") ||\n                url.pathname.startsWith("/books/") ||\n                url.pathname.startsWith("/catalog/") ||\n                url.pathname.startsWith("/classics/") ||\n                url.pathname.startsWith("/covers/") ||\n                ["/ads.txt", "/icon.svg", "/llms.txt", "/robots.txt", "/sitemap.xml", "/sw.js"].includes(url.pathname);\n            if (viteAssetRequest) {\n                return env.ASSETS.fetch(request);\n            }\n`;
const alreadyPatched = workerSource.includes("            const viteAssetRequest =\n");

if (!alreadyPatched && !workerSource.includes(routeAnchor)) {
  throw new Error("Could not find the OpenNext URL-routing anchor; refusing to publish an unpatched reader shell.");
}

if (!alreadyPatched) {
  await writeFile(workerPath, workerSource.replace(routeAnchor, assetRouting), "utf8");
}
console.log(`Merged browser-safe Vite assets from ${source} into ${target}.`);
