import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

import { syncSeoAssets, planSync } from "../sync-data-assets.mjs";
import { assertSeoSnapshot, enumerateSeoFiles, ownedBySeo } from "../lib/seo-asset-contract.mjs";
import { patchHomepageHtml } from "../lib/homepage-seo.mjs";
import { fingerprintFiles, fingerprintEnv, digestTree } from "../lib/build-fingerprint.mjs";

async function put(root, rel, content) {
  const p = join(root, rel);
  await mkdir(dirname(p), { recursive:true });
  await writeFile(p, typeof content === "string" ? content : JSON.stringify(content));
}
async function fixture() {
  const tmp = await mkdtemp(join(tmpdir(),"soma-inc-test-"));
  const source=join(tmp,"source"), target=join(tmp,"target");
  await mkdir(source); await mkdir(target);
  const book={slug:"sample",total_chapters:2};
  await put(source,"catalog/books.json",[book]);
  await put(source,"catalog/home-seo.json",{schemaVersion:1,classicCount:80,featuredCover:null});
  for(const rel of ["sitemap.xml","sitemap-home.xml","sitemap-books-en.xml","sitemap-books-sw.xml","sitemap-chapters.xml","feed.xml","robots.txt","llms.txt","llms-full.txt","llm-policy.json","ai.txt"])
    await put(source,rel,"current:"+rel);
  await put(source,"books/index.html","catalogue");
  await put(source,"books/sample/index.html","sample html");
  await put(source,"reader-data/sample/manifest.json",{chapters:[{number:1},{number:2}]});
  await put(source,"read/sample/1.html","chapter1");
  await put(source,"read/sample/2.html","chapter2");
  await put(target,"reader-static.js","immutable browser script");
  await put(target,"assets/entry-123.js","immutable vite bundle");
  await put(target,"_headers","immutable headers");
  return {tmp,source,target};
}

test("SEO paths have narrow ownership: no scripts, headers, or browser bundle",()=>{
  for(const path of ["books/x/index.html","reader-data/x/manifest.json","catalog/books.json","sitemap-books-en.xml","ai.txt"])
    assert.equal(ownedBySeo(path),true,path);
  for(const path of ["../escape","books/../bad","/root","assets/main.js","_headers","sw.js","reader-static.js","catalog/unknown.json"])
    assert.equal(ownedBySeo(path),false,path);
});

test("safe sync supports dry-run, writes, updates, deletions, and unchanged protected assets",async(t)=>{
  const x=await fixture(); t.after(()=>rm(x.tmp,{recursive:true,force:true}));
  assert.equal((await assertSeoSnapshot(x.source)).books,1);
  const plan=await syncSeoAssets(x.source,x.target,{dryRun:true});
  assert.ok(plan.counts.new>0);
  assert.equal((await enumerateSeoFiles(x.target)).length,0);
  await syncSeoAssets(x.source,x.target);
  const second=await planSync(x.source,x.target);
  assert.deepEqual(second.counts,{new:0,updated:0,removed:0,unchanged:plan.counts.new});
  await put(x.source,"read/sample/2.html","chapter2 improved");
  await put(x.target,"books/withdrawn/index.html","old book");
  const update=await syncSeoAssets(x.source,x.target);
  assert.equal(update.counts.updated,1);
  assert.equal(update.counts.removed,1);
  assert.equal(await readFile(join(x.target,"read/sample/2.html"),"utf8"),"chapter2 improved");
  assert.equal(await readFile(join(x.target,"reader-static.js"),"utf8"),"immutable browser script");
  assert.equal(await readFile(join(x.target,"assets/entry-123.js"),"utf8"),"immutable vite bundle");
  assert.equal(await readFile(join(x.target,"_headers"),"utf8"),"immutable headers");
});

test("malformed catalog and missing published chapter fail before any modifications",async(t)=>{
  const x=await fixture(); t.after(()=>rm(x.tmp,{recursive:true,force:true}));
  await rm(join(x.source,"read/sample/1.html"));
  await assert.rejects(syncSeoAssets(x.source,x.target),/Missing chapter HTML/);
  assert.equal((await enumerateSeoFiles(x.target)).length,0);
});

test("symlinks inside generated trees are rejected",async(t)=>{
  const x=await fixture(); t.after(()=>rm(x.tmp,{recursive:true,force:true}));
  await symlink("/etc/passwd",join(x.source,"read/sample/untrusted.html"));
  await assert.rejects(syncSeoAssets(x.source,x.target),/Unsafe asset node/);
});

test("mass deletions are blocked without explicit approval",async(t)=>{
  const x=await fixture(); t.after(()=>rm(x.tmp,{recursive:true,force:true}));
  for(let i=0;i<12;i++)await put(x.target,"books/old-"+i+"/index.html","old");
  await assert.rejects(syncSeoAssets(x.source,x.target),/MASS_DELETE_APPROVAL_REQUIRED/);
  const approved=await syncSeoAssets(x.source,x.target,{approveMassDeletion:true});
  assert.equal(approved.removedBooks,12);
});

test("homepage patch updates only SEO fragments and preserves compiled asset URLs",()=>{
 const original=String.raw`<head><meta name="description" content="browse 80 professionally re-typeset English classics">
 <!-- HOME_FEATURED_PRELOAD_START -->
 <link rel="preload" href="https://old.example/c.jpg" fetchpriority="high">
 <!-- HOME_FEATURED_PRELOAD_END -->
 <script type="module" src="/assets/app-abc123.js"></script>
 <p>Over a thousand public-domain English classics.</p></head>`;
 const patched=patchHomepageHtml(original,{schemaVersion:1,classicCount:1234,featuredCover:"https://img.example/new.jpg"});
 assert.match(patched,/1,234 professionally/);
 assert.match(patched,/1,234 public-domain/);
 assert.ok(patched.includes("https://img.example/new.jpg"));
 assert.ok(patched.includes("/assets/app-abc123.js"));
 assert.equal(patchHomepageHtml(patched,{schemaVersion:1,classicCount:1234,featuredCover:"https://img.example/new.jpg"}),patched);
 assert.throws(()=>patchHomepageHtml("<html></html>",{schemaVersion:1,classicCount:1,featuredCover:null}),/F10_HOME_PATCH_NOT_SAFE/);
});

test("fingerprint deterministic; excludes generated SEO content but catches runtime changes",async(t)=>{
 const x=await fixture(); t.after(()=>rm(x.tmp,{recursive:true,force:true}));
 const base=join(x.tmp,"code");await mkdir(base);
 await put(base,"app/route.js","const name='stable';");
 await put(base,"public/catalog/books.json","old data");
 await put(base,"public/reader-static.js","browser data");
 const before=await fingerprintFiles(base,{dirs:["app","public"],files:[]});
 await put(base,"public/catalog/books.json","new data");
 const unchanged=await fingerprintFiles(base,{dirs:["app","public"],files:[]});
 assert.equal(before.sha256,unchanged.sha256);
 await put(base,"public/reader-static.js","new browser data");
 const after=await fingerprintFiles(base,{dirs:["app","public"],files:[]});
 assert.notEqual(before.sha256,after.sha256);
 const envA=await fingerprintEnv(base,{NEXT_PUBLIC_SITE_URL:"https://a.example"});
 const envB=await fingerprintEnv(base,{NEXT_PUBLIC_SITE_URL:"https://b.example"});
 assert.notEqual(envA,envB);
});
