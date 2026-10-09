#!/usr/bin/env node
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { patchBuiltHomepage } from "./lib/homepage-seo.mjs";

async function main() {
  const args = process.argv.slice(2);
  function readOpt(flag, defaultValue) {
    const i = args.indexOf(flag);
    return i < 0 ? defaultValue : args[i+1];
  }
  const html = resolve(readOpt("--html", "dist/index.html"));
  const metadata = resolve(readOpt("--metadata", "public/catalog/home-seo.json"));
  const result = await patchBuiltHomepage(html, metadata);
  console.log(JSON.stringify({html, metadata, ...result}));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((e)=>{console.error(e.message);process.exitCode=1;});
}
