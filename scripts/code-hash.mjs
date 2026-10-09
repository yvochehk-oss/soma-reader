#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildFingerprint, digestTree, shaFile } from "./lib/build-fingerprint.mjs";

export async function verifyBuildCache(root, target = "preview", stateDir = resolve(root, ".soma-deploy-state"), providedEnv = process.env) {
  if (!["preview", "production"].includes(target)) throw new Error("Invalid target");
  const fingerprint = await buildFingerprint(root, providedEnv);
  const stateFile = resolve(stateDir, target + ".json");
  const state = await readFile(stateFile, "utf8").then(JSON.parse).catch((e) => {
    if (e.code === "ENOENT") return null;
    throw e;
  });
  if (!state || state.schemaVersion !== 1 || state.target !== target ||
      state.verifiedAt == null) return { mode: "full", reason: "F01_MISSING_SUCCESS_STATE", fingerprint };
  if (!/^[0-9a-f-]{36}$/.test(state.cacheId ?? "")) return { mode: "full", reason: "F01_MISSING_SUCCESS_STATE", fingerprint };
  const cacheRoot = resolve(root, ".soma-deploy-cache", target, state.cacheId);
  const worker = resolve(cacheRoot, ".open-next/worker.js");
  const workerSha256 = await shaFile(worker).catch((e) => e.code === "ENOENT" ? null : Promise.reject(e));
  if (!workerSha256) return { mode: "full", reason: "F02_MISSING_WORKER", fingerprint };
  if (fingerprint.codeFingerprint !== state.codeFingerprint) return { mode: "full", reason: "F03_CODE_FINGERPRINT_CHANGED", fingerprint };
  if (fingerprint.buildEnvFingerprint !== state.buildEnvFingerprint) return { mode: "full", reason: "F04_BUILD_ENV_CHANGED", fingerprint };
  if (workerSha256 !== state.workerSha256) return { mode: "full", reason: "F08_INCONSISTENT_ASSET_TREE", fingerprint };
  const viteDigest = await digestTree(resolve(cacheRoot, ".open-next/assets/assets"), { allowMissing: true });
  if (!viteDigest || viteDigest !== state.viteImmutableAssetsDigest) return { mode: "full", reason: "F05_IMMUTABLE_ASSET_MISMATCH", fingerprint };
  const manifest = await shaFile(resolve(cacheRoot, ".build-manifest.json")).catch((e) => e.code === "ENOENT" ? null : Promise.reject(e));
  if (!manifest || manifest !== state.seoManifestSha256) return { mode: "full", reason: "F06_MISSING_SEO_BASELINE", fingerprint };
  const snapshot = await digestTree(resolve(cacheRoot, ".open-next/assets"), { allowMissing: true });
  if (!snapshot || snapshot !== state.assetsTreeDigest) return { mode: "full", reason: "F08_INCONSISTENT_ASSET_TREE", fingerprint };
  const publicTree = await digestTree(resolve(cacheRoot, "public"), { allowMissing: true });
  if (!publicTree || publicTree !== state.publicTreeDigest) return { mode: "full", reason: "F08_INCONSISTENT_ASSET_TREE", fingerprint };
  return { mode: "data", reason: null, fingerprint };
}

async function main() {
  const [action="show",...args] = process.argv.slice(2);
  const pos = args.indexOf("--target");
  const target = pos < 0 ? "preview" : args[pos+1];
  if (!["preview","production"].includes(target)) throw new Error("--target must be preview|production");
  const root = resolve(".");
  const result = action === "show" ? await buildFingerprint(root) :
    action === "verify" ? await verifyBuildCache(root, target) : null;
  if (!result) throw new Error("Usage: node scripts/code-hash.mjs [show|verify] --target preview|production");
  console.log(JSON.stringify(result, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((e)=>{console.error(e.message);process.exitCode=1;});
}
