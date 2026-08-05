import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = resolve("dist");
const target = resolve(".open-next/assets");
const securityHeaders = `/*
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://pagead2.googlesyndication.com https://*.googlesyndication.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://generativelanguage.googleapis.com; frame-src https://*.googlesyndication.com https://googleads.g.doubleclick.net; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  Referrer-Policy: strict-origin-when-cross-origin
  Strict-Transport-Security: max-age=31536000
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
`;

await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true, force: true });
await Promise.all([
  rm(resolve(target, "server.cjs"), { force: true }),
  rm(resolve(target, "server.cjs.map"), { force: true }),
  writeFile(resolve(target, "_headers"), securityHeaders, "utf8"),
]);
console.log(`Merged browser-safe Vite assets from ${source} into ${target}.`);
