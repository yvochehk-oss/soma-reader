import {readFile,writeFile,rename,mkdir,rm} from "node:fs/promises";
import {resolve,dirname} from "node:path";
const SCENARIOS=["added","updated","withdrawn"];
export async function recordPreviewValidation(root,scenario,runId,deploymentId,proof) {
  if(!SCENARIOS.includes(scenario) ||
     !/^[0-9a-f-]{36}$/.test(runId) ||
     !/^[0-9a-f-]{36}$/.test(deploymentId)) throw new Error("Invalid verified preview evidence");
  const path=resolve(root,".soma-deploy-state/preview-gates.json");
  const prior=await readFile(path,"utf8").then(JSON.parse).catch(e=>
    e.code==="ENOENT"?{schemaVersion:1,runs:[]}:Promise.reject(e));
  if(prior.schemaVersion!==1 || !Array.isArray(prior.runs))throw new Error("Invalid preview gate state");
  const runs=prior.runs.filter(r=>r.runId!==runId);
  runs.push({scenario,runId,deploymentId,verifiedAt:new Date().toISOString(),added:proof.added,updated:proof.updated,removed:proof.removed});
  const scenarios=new Set(runs.map(r=>r.scenario));
  const validatedRuns=runs.filter(r=>SCENARIOS.includes(r.scenario)).map(r=>r.runId);
  const result={schemaVersion:1,status:SCENARIOS.every(s=>scenarios.has(s))&&new Set(validatedRuns).size>=3?"passed":"incomplete",
    validatedRuns,runs};
  await mkdir(dirname(path),{recursive:true});
  const temp=path+"."+runId+".tmp";
  try{await writeFile(temp,JSON.stringify(result,null,2)+"\n");await rename(temp,path);}
  finally{await rm(temp,{force:true});}
  return result;
}