import assert from "node:assert/strict";
import test from "node:test";
import {mkdir,mkdtemp,readFile,writeFile,rm} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {randomUUID} from "node:crypto";
import {selectMode,prepareWranglerConfig,injectPreviewNoindex} from "../deploy-soma-site.mjs";
import {buildFingerprint,digestTree,shaFile} from "../lib/build-fingerprint.mjs";
import {verifyBuildCache} from "../code-hash.mjs";
import {withDeploymentLock,saveDeploymentState,readDeploymentState} from "../lib/deployment-state.mjs";
import {recordPreviewValidation} from "../lib/preview-gates.mjs";

async function setup(t) {
 const root=await mkdtemp(join(tmpdir(),"soma-gate-"));t.after(()=>rm(root,{recursive:true,force:true}));
 await mkdir(join(root,"app"),{recursive:true});
 await writeFile(join(root,"app/route.js"),"return 1;");
 return root;
}
async function write(root,path,text) {
 const file=join(root,path);
 await mkdir(file.slice(0,file.lastIndexOf("/")),{recursive:true});
 await writeFile(file,text);
}
test("fallback rules reject strict data but retain automatic full",()=>{
 assert.equal(selectMode({dataOnly:true},{mode:"full",reason:"F01"}).actual,"full");
 assert.throws(()=>selectMode({dataOnly:true,strictDataOnly:true},{mode:"full",reason:"F01"}),/STRICT_DATA_ONLY/);
 assert.equal(selectMode({dataOnly:true},{mode:"data"}).actual,"data");
 assert.equal(selectMode({forceFull:true},{mode:"data"}).actual,"full");
});
test("preview Wrangler configuration isolates worker self-binding and avoids route changes",()=>{
 const source=JSON.stringify({name:"soma-reader",main:".open-next/worker.js",
   assets:{directory:".open-next/assets",binding:"ASSETS"},
   services:[{binding:"WORKER_SELF_REFERENCE",service:"soma-reader"}],
   vars:{NEXT_PUBLIC_SUPABASE_URL:"https://production.example",NEXT_PUBLIC_SUPABASE_ANON_KEY:"public-prod"}});
 assert.throws(()=>prepareWranglerConfig(source,".","preview",{}),/PREVIEW_ENV_MISSING/);
 assert.throws(()=>prepareWranglerConfig(source,".","preview",
 {previewUrl:"https://production.example",previewKey:"pk",previewBaseUrl:"https://preview.workers.dev"}),/PREVIEW_NOT_ISOLATED/);
 const config=prepareWranglerConfig(source,".","preview",
 {previewUrl:"https://test.supabase.co",previewKey:"public-test",previewBaseUrl:"https://preview.workers.dev"});
 assert.equal(config.name,"soma-reader-incremental-preview");
 assert.equal(config.services[0].service,config.name);
 assert.equal(config.vars.NEXT_PUBLIC_SUPABASE_URL,"https://test.supabase.co");
 assert.equal(config.workers_dev,true);
 assert.ok(!("routes" in config));
 assert.match(injectPreviewNoindex("/*\n  Cache-Control: public"),/X-Robots-Tag: noindex/);
});
test("cross-process lock denies overlapping publisher and releases on failure",async(t)=>{
 const root=await setup(t);let attempts=0;
 await withDeploymentLock(root,"preview",async()=>{
   await assert.rejects(withDeploymentLock(root,"preview",async()=>attempts++),/DEPLOY_LOCKED/);
 });
 assert.equal(attempts,0);
 await assert.rejects(withDeploymentLock(root,"preview",async()=>{throw Error("stop");}),/stop/);
 await withDeploymentLock(root,"preview",async()=>{attempts++;});
 assert.equal(attempts,1);
});
test("code and build environment guard check worker, immutable vite, manifest, and full asset tree",async(t)=>{
 const root=await setup(t),cacheId=randomUUID(),target="preview";
 await write(root,".soma-deploy-cache/preview/"+cacheId+"/.open-next/worker.js","worker");
 await write(root,".soma-deploy-cache/preview/"+cacheId+"/.open-next/assets/assets/app.js","app");
 await write(root,".soma-deploy-cache/preview/"+cacheId+"/.open-next/assets/catalog/books.json","[]");
 await write(root,".soma-deploy-cache/preview/"+cacheId+"/.build-manifest.json",'{"version":1}');
 await write(root,".soma-deploy-cache/preview/"+cacheId+"/public/catalog/books.json","[]");
 const dir=join(root,".soma-deploy-cache/preview",cacheId);
 const fingerprint=await buildFingerprint(root,{NEXT_PUBLIC_SITE_URL:"https://test.example"});
 const state={schemaVersion:1,target,cacheId,codeFingerprint:fingerprint.codeFingerprint,
  buildEnvFingerprint:fingerprint.buildEnvFingerprint,workerSha256:await shaFile(join(dir,".open-next/worker.js")),
  viteImmutableAssetsDigest:await digestTree(join(dir,".open-next/assets/assets")),
  assetsTreeDigest:await digestTree(join(dir,".open-next/assets")),
  publicTreeDigest:await digestTree(join(dir,"public")),
  seoManifestSha256:await shaFile(join(dir,".build-manifest.json")),
  deploymentId:randomUUID(),verifiedAt:new Date().toISOString()};
 await saveDeploymentState(root,target,state);
 assert.equal((await verifyBuildCache(root,target,join(root,".soma-deploy-state"),{NEXT_PUBLIC_SITE_URL:"https://test.example"})).mode,"data");
 assert.equal((await verifyBuildCache(root,target,undefined,{NEXT_PUBLIC_SITE_URL:"https://other.example"})).reason,"F04_BUILD_ENV_CHANGED");
 await write(root,"app/route.js","return 2;");
 assert.equal((await verifyBuildCache(root,target,undefined,{NEXT_PUBLIC_SITE_URL:"https://test.example"})).reason,"F03_CODE_FINGERPRINT_CHANGED");
 await write(root,"app/route.js","return 1;");
 await write(root,".soma-deploy-cache/preview/"+cacheId+"/.open-next/assets/assets/app.js","broken");
 assert.equal((await verifyBuildCache(root,target,undefined,{NEXT_PUBLIC_SITE_URL:"https://test.example"})).reason,"F05_IMMUTABLE_ASSET_MISMATCH");
});
test("success cursor cannot be written before verified remote deployment",async(t)=>{
 const root=await setup(t);
 await assert.rejects(saveDeploymentState(root,"preview",{schemaVersion:1,target:"preview",cacheId:randomUUID()}),/unverified/);
 assert.equal(await readDeploymentState(root,"preview"),null);
});
test("three distinct scenario validations are required for production gate",async(t)=>{
 const root=await setup(t);
 const a=await recordPreviewValidation(root,"added",randomUUID(),randomUUID(),{added:2,updated:0,removed:0});
 assert.equal(a.status,"incomplete");
 const b=await recordPreviewValidation(root,"updated",randomUUID(),randomUUID(),{added:0,updated:1,removed:0});
 assert.equal(b.status,"incomplete");
 const c=await recordPreviewValidation(root,"withdrawn",randomUUID(),randomUUID(),{added:0,updated:0,removed:1});
 assert.equal(c.status,"passed");
 assert.equal(new Set(c.validatedRuns).size,3);
});