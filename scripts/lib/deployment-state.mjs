import { mkdir, writeFile, readFile, rename, rm, cp, lstat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

export const TARGETS = new Set(["preview", "production"]);
export function assertTarget(target) {
  if (!TARGETS.has(target)) throw new Error("Target must be preview or production");
  return target;
}
export function stateDirectory(root) { return resolve(root, ".soma-deploy-state"); }
export function cacheDirectory(root,target) {
  assertTarget(target);
  return resolve(root, ".soma-deploy-cache", target);
}
export async function withDeploymentLock(root, target, fn) {
  assertTarget(target);
  const stateDir = stateDirectory(root);
  await mkdir(stateDir,{recursive:true});
  const lock = join(stateDir,target+".lock");
  try { await mkdir(lock); }
  catch (error) {
    if (error.code === "EEXIST") throw new Error("DEPLOY_LOCKED: " + target + ". Check the existing publisher before manual recovery.");
    throw error;
  }
  try {
    await writeFile(join(lock,"owner.json"),JSON.stringify({pid:process.pid,startedAt:new Date().toISOString(),target})+"\n");
    return await fn();
  } finally { await rm(lock,{recursive:true,force:true}); }
}
export async function readDeploymentState(root,target) {
  assertTarget(target);
  return readFile(join(stateDirectory(root),target+".json"),"utf8").then(JSON.parse).catch((e)=>{
    if(e.code==="ENOENT")return null;
    throw e;
  });
}
export async function saveDeploymentState(root,target,state) {
  assertTarget(target);
  if (!state || state.schemaVersion !== 1 || state.target !== target ||
      !state.deploymentId || !state.verifiedAt || !/^[0-9a-f-]{36}$/.test(state.cacheId)) {
    throw new Error("Refusing unverified deployment success state");
  }
  const path=join(stateDirectory(root),target+".json");
  await mkdir(stateDirectory(root),{recursive:true});
  const temp=path+"."+randomUUID()+".tmp";
  try {
    await writeFile(temp,JSON.stringify(state,null,2)+"\n",{flag:"wx",mode:0o600});
    await rename(temp,path);
  } finally { await rm(temp,{force:true}); }
}
export async function writeAudit(root,runId,audit) {
  if (!/^[0-9a-f-]{36}$/.test(runId)) throw new Error("Invalid runId");
  const folder=resolve(root,".soma-deploy-work",runId);
  await mkdir(folder,{recursive:true});
  const temp=join(folder,"audit.json.tmp"),file=join(folder,"audit.json");
  await writeFile(temp,JSON.stringify(audit,null,2)+"\n");
  await rename(temp,file);
}
export async function persistCache(root,target,runId,source) {
  assertTarget(target);
  if(!/^[0-9a-f-]{36}$/.test(runId))throw new Error("Invalid cache runId");
  const base=cacheDirectory(root,target);
  const destination=join(base,runId);
  await mkdir(base,{recursive:true});
  if (await lstat(destination).catch((e)=>e.code==="ENOENT"?null:Promise.reject(e))) throw new Error("Cache version already exists");
  await cp(source,destination,{recursive:true,errorOnExist:true,force:false});
  return destination;
}
export async function writeRecoveryState(root,target,state) {
  assertTarget(target);
  const directory=stateDirectory(root);
  await mkdir(directory,{recursive:true});
  const path=join(directory,target+".recovery.json"),tmp=path+".tmp";
  await writeFile(tmp,JSON.stringify(state,null,2)+"\n");
  await rename(tmp,path);
}
