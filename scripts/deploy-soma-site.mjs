#!/usr/bin/env node
// Safe deployment coordinator. Production requires completed preview evidence;
// no live deployment is performed by --dry-run.
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cp, mkdir, readFile, writeFile, rm, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertSeoSnapshot } from "./lib/seo-asset-contract.mjs";
import { syncSeoAssets } from "./sync-data-assets.mjs";
import { patchBuiltHomepage } from "./lib/homepage-seo.mjs";
import { buildFingerprint, digestTree, shaFile } from "./lib/build-fingerprint.mjs";
import { verifyBuildCache } from "./code-hash.mjs";
import { withDeploymentLock, readDeploymentState, saveDeploymentState, writeAudit, persistCache, writeRecoveryState } from "./lib/deployment-state.mjs";
import { assertCloudflareStaticAssetLimits } from "./lib/cloudflare-static-asset-limits.mjs";
import { recordPreviewValidation } from "./lib/preview-gates.mjs";
import { assertProductionDataGate } from "./lib/production-gate.mjs";
import { diffPublishedBooks, changedChapterNumbers, removedChapterNumbers } from "./lib/publication-diff.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const PREVIEW_WORKER = "soma-reader-incremental-preview";
const PRODUCTION_WORKER = "soma-reader";
const SITE_URL = "https://somanovel.uk";
const DEPLOY_PATHS = ["public",".open-next",".build-manifest.json"];
const NOW = () => new Date().toISOString();

export function selectMode(request, gate) {
  if (request.forceFull || !request.dataOnly) return { requested: request.forceFull ? "full" : "full", actual:"full",fallbackReason:null };
  if (gate.mode==="data") return { requested:"data", actual:"data", fallbackReason:null };
  if (request.strictDataOnly) throw new Error("STRICT_DATA_ONLY: " + gate.reason);
  return { requested:"data", actual:"full", fallbackReason:gate.reason };
}

export function assertPreviewIsolation(previewUrl,productionUrl,previewBaseUrl) {
  try {
    const previewDb=new URL(previewUrl),productionDb=new URL(productionUrl);
    const previewWorker=new URL(previewBaseUrl);
    const safeDb=previewDb.protocol==="https:" && !previewDb.username && !previewDb.password &&
      previewDb.pathname==="/" && !previewDb.search && !previewDb.hash &&
      previewDb.origin!==productionDb.origin;
    const safeWorker=previewWorker.protocol==="https:" && !previewWorker.username && !previewWorker.password &&
      /^soma-reader-incremental-preview\.[a-z0-9-]+\.workers\.dev$/.test(previewWorker.hostname) &&
      previewWorker.pathname==="/" && !previewWorker.search && !previewWorker.hash;
    if(!safeDb||!safeWorker)throw new Error("Preview origin does not satisfy isolation checks");
  }catch{
    throw new Error("PREVIEW_NOT_ISOLATED");
  }
}

export function assertPreviewScenarioBaseline(target,scenario,existing) {
  if(target==="preview" && scenario && (!existing || !existing.deploymentId || !existing.verifiedAt)) {
    throw new Error("PREVIEW_SCENARIO_BASELINE_REQUIRED");
  }
}

export function prepareWranglerConfig(text, candidate, target, env) {
  if (!["production","preview"].includes(target)) throw new Error("Unknown deploy target");
  // Current wrangler.jsonc contains JSON with trailing commas; disallow
  // fallback parsing that could silently reinterpret arbitrary comments.
  const config=JSON.parse(text.replace(/,\s*([}\]])/g,"$1"));
  if (config.name!==PRODUCTION_WORKER || config.main!==".open-next/worker.js" ||
      config.assets?.directory!==".open-next/assets") throw new Error("Unexpected production Wrangler baseline");
  if (!Array.isArray(config.services) || config.services.length!==1 ||
      config.services[0].service!==PRODUCTION_WORKER) throw new Error("Unexpected Worker self-reference");
  if ("routes" in config || "route" in config) throw new Error("Route management is not allowed in data deploy config");
  if (target==="preview") {
    if(!env.previewUrl || !env.previewKey || !env.previewBaseUrl) throw new Error("PREVIEW_ENV_MISSING");
    assertPreviewIsolation(env.previewUrl,config.vars.NEXT_PUBLIC_SUPABASE_URL,env.previewBaseUrl);
    config.name=PREVIEW_WORKER;
    config.services[0].service=PREVIEW_WORKER;
    config.vars.NEXT_PUBLIC_SUPABASE_URL=env.previewUrl;
    config.vars.NEXT_PUBLIC_SUPABASE_ANON_KEY=env.previewKey;
    config.workers_dev=true;
    delete config.routes;
    delete config.route;
  } else {
    config.name=PRODUCTION_WORKER;
  }
  // Config lives within the candidate directory; main & ASSETS are
  // resolved relative to it, never to the production checkout.
  config.main=".open-next/worker.js";
  config.assets.directory=".open-next/assets";
  return config;
}

export function injectPreviewNoindex(headers) {
  const marker="/*\n";
  if (!headers.startsWith(marker) || headers.includes("X-Robots-Tag:")) throw new Error("Cannot safely patch preview headers");
  return headers.replace(marker,marker+"  X-Robots-Tag: noindex, nofollow, noarchive\n");
}

function run(command,args,{cwd=ROOT,env=process.env,timeout=180000}={}) {
  return new Promise((resolvePromise,reject)=>{
    const child=spawn(command,args,{cwd,env,stdio:["ignore","pipe","pipe"]});
    let out="",err="";
    child.stdout.on("data",chunk=>{out=(out+chunk).slice(-100000);});
    child.stderr.on("data",chunk=>{err=(err+chunk).slice(-100000);});
    const timer=setTimeout(()=>child.kill("SIGTERM"),timeout);
    child.once("error",error=>{clearTimeout(timer);reject(error);});
    child.once("close",(code,signal)=>{
      clearTimeout(timer);
      if(code===0)resolvePromise({output:out,error:err});
      else reject(new Error(command+" "+args.slice(0,3).join(" ")+" failed ("+(signal||code)+"): "+err.slice(-700)));
    });
  });
}

function publicEnv(target,wrangler,provided) {
  if(target==="preview"){
    const previewUrl=provided.SOMA_PREVIEW_SUPABASE_URL;
    const previewKey=provided.SOMA_PREVIEW_SUPABASE_ANON_KEY;
    const previewBaseUrl=provided.SOMA_PREVIEW_BASE_URL;
    if(!previewUrl||!previewKey||!previewBaseUrl) throw new Error("PREVIEW_ENV_MISSING: need separate test Supabase and preview URL");
    assertPreviewIsolation(previewUrl,wrangler.vars.NEXT_PUBLIC_SUPABASE_URL,previewBaseUrl);
    return {previewUrl,previewKey,previewBaseUrl};
  }
  return {previewUrl:null,previewKey:null,previewBaseUrl:null};
}

export function effectiveEnv(target,config,provided) {
  const env={...provided,
    NEXT_PUBLIC_SUPABASE_URL:config.vars.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY:config.vars.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    VITE_SUPABASE_URL:config.vars.NEXT_PUBLIC_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY:config.vars.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
  return env;
}

async function copyCandidate(source,dest) {
  await mkdir(dest,{recursive:true});
  for(const name of DEPLOY_PATHS) {
    const src=join(source,name),st=await stat(src).catch(e=>e.code==="ENOENT"?null:Promise.reject(e));
    if(!st) throw new Error("Missing verified build snapshot: "+src);
    await cp(src,join(dest,name),{recursive:true,force:true});
  }
}
export async function liveVerify(base,candidate,previous) {
  const baseUrl=base.replace(/\/$/,"");
  const catalog=JSON.parse(await readFile(join(candidate,"public/catalog/books.json"),"utf8"));
  const before=previous? JSON.parse(await readFile(join(previous,"public/catalog/books.json"),"utf8")) : [];
  const currentManifest=JSON.parse(await readFile(join(candidate,".build-manifest.json"),"utf8"));
  const previousManifest=previous? JSON.parse(await readFile(join(previous,".build-manifest.json"),"utf8")) : null;
  const {added,updated,removed,changed}=diffPublishedBooks(catalog,before,currentManifest.books,previousManifest?.books);
  async function check(path,assertFn) {
    let problem=null;
    for(let attempt=0;attempt<3;attempt++){
      try{
        const separator=path.includes("?")?"&":"?";
        const url=baseUrl+path+separator+"_soma_verification="+attempt+"-"+Date.now();
        const response=await fetch(url,{cache:"no-store",headers:{"cache-control":"no-cache"}});
        const text=await response.text();
        if(assertFn(response,text))return {url:path,status:response.status};
        problem="status="+response.status+" bytes="+Buffer.byteLength(text);
      }catch(e){problem=e.message;}
    }
    throw new Error("LIVE_VERIFICATION_FAILED: "+path+" "+problem);
  }
  async function checkExact(path,asset) {
    const expected=await readFile(join(candidate,"public",asset),"utf8");
    return check(path,(response,html)=>response.status===200&&html===expected);
  }
  const proof=[];
  const snapshot=await assertSeoSnapshot(join(candidate,"public"));
  if(snapshot.books!==catalog.length) throw new Error("Catalogue mismatch");
  proof.push(await checkExact("/catalog/books.json","catalog/books.json"));
  proof.push(await checkExact("/sitemap.xml","sitemap.xml"));
  for(const page of ["/feed.xml","/llms.txt","/llms-full.txt","/ai.txt","/llm-policy.json","/robots.txt"]){
    proof.push(await check(page,(r)=>r.ok));
  }
  const expectedHome=await readFile(join(candidate,".open-next/assets/index.html"),"utf8");
  proof.push(await check("/",(r,html)=>r.status===200&&html===expectedHome));
  if(previous && changed.length>10)throw new Error("Too many changed books for automatic verification");
  let modifiedChapters=0;
  // Verify changed books, or a representative unchanged book on a no-op
  for(const book of (changed.length?changed:catalog.slice(0,1)).slice(0,10)){
    proof.push(await checkExact("/books/"+encodeURIComponent(book.slug)+"/","books/"+book.slug+"/index.html"));
    const mf=JSON.parse(await readFile(join(candidate,"public/reader-data",book.slug,"manifest.json"),"utf8"));
    const changedNumbers=await changedChapterNumbers(join(candidate,"public"),previous?join(previous,"public"):null,book.slug,mf);
    if(previous && changedNumbers.length>60)throw new Error("Too many chapter changes for automatic remote verification: "+book.slug);
    if(previous && updated.some(row=>row.slug===book.slug))modifiedChapters+=changedNumbers.length;
    const numbers=[...new Set([mf.chapters[0].number,mf.chapters.at(-1).number,...changedNumbers.slice(0,60)])];
    for(const number of numbers){
      proof.push(await checkExact("/read/"+book.slug+"/"+number,"read/"+book.slug+"/"+number+".html"));
    }
    if(previous && !added.some(row=>row.slug===book.slug)){
      for(const removedNumber of await removedChapterNumbers(join(candidate,"public"),join(previous,"public"),book.slug)){
        proof.push(await check("/read/"+book.slug+"/"+removedNumber,r=>r.status===404));
      }
    }
    proof.push(await check("/read/"+book.slug+"/"+(Number(mf.chapters.at(-1).number)+1),
      r=>r.status===404));
  }
  for(const book of removed.slice(0,15)) {
    proof.push(await check("/books/"+encodeURIComponent(book.slug)+"/",r=>r.status===404));
    const oldManifest=JSON.parse(await readFile(join(previous,"public/reader-data",book.slug,"manifest.json"),"utf8"));
    for(const chapter of oldManifest.chapters){
      proof.push(await check("/read/"+encodeURIComponent(book.slug)+"/"+chapter.number,r=>r.status===404));
    }
  }
  if(removed.length>15)throw new Error("Too many withdrawals for automatic remote verification");
  return {checks:proof,changed:changed.length,added:added.length,updated:updated.length,modifiedChapters,removed:removed.length,addedLanguages:[...new Set(added.map(b=>b.language_code))]};
}

function deploymentId(output) {
  // Output format changes between Wrangler versions: accept an explicit
  // UUID-shaped Version ID / Deployment ID, never invent an ID from a clock.
  const matches=[...output.matchAll(/(?:Deployment ID|Version ID|deployment_id|version_id)[:\s"]+([0-9a-f]{8}-[0-9a-f-]{27,})/gi)];
  return matches.at(-1)?.[1] ?? null;
}

export async function publishSite(options) {
  const {target,dataOnly=false,forceFull=false,strictDataOnly=false,dryRun=false,approveProduction=false,scenario=null}=options;
  if(!["production","preview"].includes(target))throw new Error("Explicit --target preview|production is mandatory");
  const runId=randomUUID(),startedAt=NOW(),start=performance.now();
  const audit={schemaVersion:1,runId,startedAt,target,requestedMode:forceFull?"full":dataOnly?"data":"full",status:"running",steps:[]};
  return withDeploymentLock(ROOT,target,async()=>{
    const dir=resolve(ROOT,".soma-deploy-work",runId);
    const candidate=join(dir,"candidate");
    const configText=await readFile(resolve(ROOT,"wrangler.jsonc"),"utf8");
    const productionConfig=JSON.parse(configText.replace(/,\s*([}\]])/g,"$1"));
    const preview=publicEnv(target,productionConfig,process.env);
    const config=prepareWranglerConfig(configText,candidate,target,preview);
    const env=effectiveEnv(target,config,process.env);
    const baseUrl=target==="preview"?preview.previewBaseUrl:SITE_URL;
    const existing=await readDeploymentState(ROOT,target);
    assertPreviewScenarioBaseline(target,scenario,existing);
    if(target==="production") {
      if(!approveProduction) throw new Error("PRODUCTION_APPROVAL_REQUIRED");
      await assertProductionDataGate(ROOT,env);
    }
    await mkdir(dir,{recursive:true});
    async function step(name,fn){
      const entry={name,startedAt:NOW(),status:"running"};
      audit.steps.push(entry);await writeAudit(ROOT,runId,audit);
      const t=performance.now();
      try{
        const result=await fn();entry.durationMs=Math.round(performance.now()-t);
        entry.result=result && typeof result.output==="string"
          ? {commandExit:0,stdoutBytes:Buffer.byteLength(result.output),stderrBytes:Buffer.byteLength(result.error??"")}
          : result;
        entry.status="passed";entry.endedAt=NOW();
        await writeAudit(ROOT,runId,audit);
        return result;
      }catch(e){
        entry.durationMs=Math.round(performance.now()-t);entry.status="failed";entry.error=e.message;
        await writeAudit(ROOT,runId,audit);throw e;
      }
    }
    try{
      const gate=await step("build-fingerprint-gate",()=>verifyBuildCache(ROOT,target,undefined,env));
      const selected=selectMode({dataOnly,forceFull,strictDataOnly},gate);
      audit.requestedMode=selected.requested;audit.actualMode=selected.actual;
      audit.fallbackReason=selected.fallbackReason;
      await writeAudit(ROOT,runId,audit);
      if(selected.actual==="full"){
        // Baseline full build is run in the isolated checkout. No changes to
        // production Worker are possible until the candidate is verified.
        await step("full-build",()=>run("npm",["run","cf:build"],{cwd:ROOT,env,timeout:360000}));
        await step("copy-full-candidate",()=>copyCandidate(ROOT,candidate));
      } else {
        const cache=join(ROOT,".soma-deploy-cache",target,existing.cacheId);
        await step("copy-verified-candidate",()=>copyCandidate(cache,candidate));
        await step("incremental-seo",()=>run(process.execPath,[resolve(ROOT,"scripts/build-seo-pages.mjs"),"--since"],
          {cwd:candidate,env,timeout:360000}));
        await step("asset-sync",async()=>{
          const report=await syncSeoAssets(join(candidate,"public"),join(candidate,".open-next/assets"));
          return {counts:report.counts,removedBooks:report.removedBooks};
        });
        await step("homepage-patch",()=>patchBuiltHomepage(join(candidate,".open-next/assets/index.html"),
          join(candidate,"public/catalog/home-seo.json")));
      }
      await step("candidate-integrity",async()=>{
        const snap=await assertSeoSnapshot(join(candidate,"public"));
        const stats=await assertCloudflareStaticAssetLimits(join(candidate,".open-next/assets"));
        const sync=await syncSeoAssets(join(candidate,"public"),join(candidate,".open-next/assets"),{dryRun:true});
        if(sync.counts.new||sync.counts.updated||sync.counts.removed)throw new Error("Candidate SEO assets differ from built assets");
        return {books:snap.books,files:stats.files,bytes:stats.totalBytes};
      });
      const fingerprint=await buildFingerprint(ROOT,env);
      const workerSha=await shaFile(join(candidate,".open-next/worker.js"));
      const viteSha=await digestTree(join(candidate,".open-next/assets/assets"));
      const manifestSha=await shaFile(join(candidate,".build-manifest.json"));
      const assetsSha=await digestTree(join(candidate,".open-next/assets"));
      const publicTreeDigest=await digestTree(join(candidate,"public"));
      const publishDir=join(dir,"publish");
      await step("configure-target",async()=>{
        await cp(join(candidate,".open-next"),join(publishDir,".open-next"),{recursive:true});
        const targetConfig={...config,main:".open-next/worker.js",assets:{...config.assets,directory:".open-next/assets"}};
        await writeFile(join(publishDir,"wrangler.jsonc"),JSON.stringify(targetConfig,null,2)+"\n");
        if(target==="preview"){
          const headers=join(publishDir,".open-next/assets/_headers");
          await writeFile(headers,injectPreviewNoindex(await readFile(headers,"utf8")));
          await writeFile(join(publishDir,".open-next/assets/robots.txt"),"User-agent: *\nDisallow: /\n");
        }
        return {workerName:config.name,previewNoindex:target==="preview"};
      });
      audit.assetsTreeDigest=assetsSha;audit.codeFingerprint=fingerprint.codeFingerprint;
      audit.workerSha256=workerSha;audit.viteImmutableAssetsDigest=viteSha;
      await writeAudit(ROOT,runId,audit);
      await step("wrangler-dry-run",()=>run("npx",["wrangler","deploy","--dry-run","--no-autoconfig","--config","wrangler.jsonc"],
        {cwd:publishDir,env,timeout:180000}));
      if(dryRun) {
        audit.status="validated-only";audit.endedAt=NOW();audit.totalMs=Math.round(performance.now()-start);
        await writeAudit(ROOT,runId,audit);
        return audit;
      }
      let liveDeployStarted=false;
      try{
        liveDeployStarted=true;
        const deployed=await step("wrangler-deploy",()=>run("npx",["wrangler","deploy","--no-autoconfig","--config","wrangler.jsonc"],
          {cwd:publishDir,env,timeout:180000}));
        const id=deploymentId(deployed.output+"\n"+deployed.error);
        if(!id)throw new Error("DEPLOYMENT_ID_NOT_VERIFIED");
        audit.deploymentId=id;
        const liveProof=await step("live-site-verification",()=>liveVerify(baseUrl,candidate,existing?
          join(ROOT,".soma-deploy-cache",target,existing.cacheId):null));
        if(target==="preview") {
          await step("preview-noindex-verification", async()=>{
            const [home,robots]=await Promise.all([
              fetch(baseUrl,{cache:"no-store"}),
              fetch(baseUrl.replace(/\/$/,"")+"/robots.txt",{cache:"no-store"}),
            ]);
            if(!home.ok || !/\bnoindex\b/i.test(home.headers.get("x-robots-tag")??""))throw new Error("PREVIEW_NOINDEX_MISSING");
            if(!robots.ok || !(await robots.text()).includes("Disallow: /"))throw new Error("PREVIEW_ROBOTS_NOT_BLOCKED");
            return {noindex:true,robotsBlocked:true};
          });
        }
        if(target==="preview" && scenario) {
          const valid=(scenario==="added" && liveProof.added>=2 && liveProof.addedLanguages.includes("en") && liveProof.addedLanguages.includes("sw")) ||
            (scenario==="updated" && liveProof.updated>=1 && liveProof.modifiedChapters>=1) ||
            (scenario==="withdrawn" && liveProof.removed>=1);
          if(!valid)throw new Error("PREVIEW_SCENARIO_NOT_PROVEN: "+scenario);
        }
        const publishCache=await step("persist-verified-cache",()=>persistCache(ROOT,target,runId,candidate));
        const gitCommit=(await run("git",["rev-parse","HEAD"])).output.trim();
        const publishedAssetsTreeDigest=await digestTree(join(publishDir,".open-next/assets"));
        await step("commit-success-state",()=>saveDeploymentState(ROOT,target,{
          schemaVersion:1,target,cacheId:runId,gitCommit,
          codeFingerprint:fingerprint.codeFingerprint,buildEnvFingerprint:fingerprint.buildEnvFingerprint,
          workerSha256:workerSha,viteImmutableAssetsDigest:viteSha,seoManifestSha256:manifestSha,
          assetsTreeDigest:assetsSha,publicTreeDigest,publishedAssetsTreeDigest,
          deploymentId:id,verifiedAt:NOW(),
        }));
        if(target==="preview" && scenario)await recordPreviewValidation(ROOT,scenario,runId,id,liveProof,fingerprint.codeFingerprint);
        audit.status="complete";audit.endedAt=NOW();audit.totalMs=Math.round(performance.now()-start);
        await writeAudit(ROOT,runId,audit);
        return audit;
      }catch(error) {
        if(liveDeployStarted) await writeRecoveryState(ROOT,target,{
          status:"REMOTE_DEPLOYED_UNVERIFIED",runId,at:NOW(),reason:error.message,
          // A failed Wrangler exit does NOT prove no remote version was created.
          cloudflareState:"unknown",oldSuccessfulDeploymentId:existing?.deploymentId??null,
        });
        throw error;
      }
    }catch(error){
      audit.status="failed";audit.error=error.message;audit.endedAt=NOW();
      audit.totalMs=Math.round(performance.now()-start);
      await writeAudit(ROOT,runId,audit);
      throw error;
    }
  });
}
function parseArgs(args){
  const allowed=new Set(["--target","--data-only","--strict-data-only","--force-full","--dry-run","--approve-production","--scenario"]);
  for(const arg of args)if(arg.startsWith("--")&&!allowed.has(arg))throw new Error("Unknown argument: "+arg);
  const pos=args.indexOf("--target");const target=pos<0?null:args[pos+1];
  if(!target)throw new Error("Usage: deploy-soma-site.mjs --target preview|production [--data-only|--force-full] [--dry-run]");
  const scenarioPos=args.indexOf("--scenario");
  const scenario=scenarioPos<0?null:args[scenarioPos+1];
  if(scenario!==null && !["added","updated","withdrawn"].includes(scenario))throw new Error("Invalid --scenario");
  return {target,scenario,dataOnly:args.includes("--data-only"),strictDataOnly:args.includes("--strict-data-only"),
    forceFull:args.includes("--force-full"),dryRun:args.includes("--dry-run"),approveProduction:args.includes("--approve-production")};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  publishSite(parseArgs(process.argv.slice(2))).then(audit=>
    console.log(JSON.stringify({runId:audit.runId,status:audit.status,actualMode:audit.actualMode,
      fallbackReason:audit.fallbackReason,deployId:audit.deploymentId??null},null,2))).catch(e=>{
    console.error("Deployment blocked/failed: "+e.message);process.exitCode=1;
  });
}
