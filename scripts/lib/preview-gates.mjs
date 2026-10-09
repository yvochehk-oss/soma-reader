import {readFile,writeFile,rename,mkdir,rm} from "node:fs/promises";
import {resolve,dirname} from "node:path";

const SCENARIOS=["added","updated","withdrawn"];
const HEX_SHA256=/^[0-9a-f]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_AGE_MS=7*24*60*60*1000;
const GATE_VERSION=2;

function verifiedScenario(run) {
  if(run.scenario==="added") return run.added>=2 &&
    run.addedLanguages.includes("en") && run.addedLanguages.includes("sw");
  if(run.scenario==="updated") return run.updated>=1 && run.modifiedChapters>=1;
  if(run.scenario==="withdrawn") return run.removed>=1;
  return false;
}

export function assertPreviewPromotionGate(gate,codeFingerprint,now=Date.now()) {
  if(!HEX_SHA256.test(codeFingerprint ?? "") || gate?.schemaVersion!==GATE_VERSION ||
     gate.status!=="passed" || !Array.isArray(gate.runs)) {
    throw new Error("PREVIEW_THREE_RUN_GATE_FAILED");
  }
  const eligible=gate.runs.filter(run=>
    run.codeFingerprint===codeFingerprint && UUID.test(run.runId ?? "") &&
    UUID.test(run.deploymentId ?? "") &&
    Array.isArray(run.addedLanguages) &&
    Number.isFinite(Date.parse(run.verifiedAt)) &&
    Date.parse(run.verifiedAt)<=now &&
    now-Date.parse(run.verifiedAt)<=MAX_AGE_MS &&
    verifiedScenario(run));
  const scenarios=new Set(eligible.map(run=>run.scenario));
  if(!SCENARIOS.every(s=>scenarios.has(s)) ||
     new Set(eligible.map(run=>run.runId)).size!==eligible.length ||
     new Set(eligible.map(run=>run.deploymentId)).size!==eligible.length ||
     !Array.isArray(gate.validatedRuns) ||
     gate.validatedRuns.length!==eligible.length ||
     gate.validatedRuns.some(id=>!eligible.some(run=>run.runId===id))) {
    throw new Error("PREVIEW_THREE_RUN_GATE_FAILED");
  }
  return {validatedRuns:eligible.map(run=>run.runId),deploymentIds:eligible.map(run=>run.deploymentId)};
}

export async function recordPreviewValidation(root,scenario,runId,deploymentId,proof,codeFingerprint) {
  if(!SCENARIOS.includes(scenario) || !UUID.test(runId ?? "") ||
     !UUID.test(deploymentId ?? "") || !HEX_SHA256.test(codeFingerprint ?? "")) {
    throw new Error("Invalid verified preview evidence");
  }
  const run={scenario,runId,deploymentId,codeFingerprint,verifiedAt:new Date().toISOString(),
    added:proof?.added??0,updated:proof?.updated??0,removed:proof?.removed??0,
    modifiedChapters:proof?.modifiedChapters??0,addedLanguages:proof?.addedLanguages??[]};
  if(!Array.isArray(run.addedLanguages) || !verifiedScenario(run)){
    throw new Error("PREVIEW_SCENARIO_NOT_PROVEN: "+scenario);
  }
  const path=resolve(root,".soma-deploy-state/preview-gates.json");
  const prior=await readFile(path,"utf8").then(JSON.parse).catch(e=>
    e.code==="ENOENT"?{schemaVersion:GATE_VERSION,runs:[]}:Promise.reject(e));
  if(prior.schemaVersion!==GATE_VERSION || !Array.isArray(prior.runs))
    throw new Error("Invalid preview gate state; old versions need fresh preview evidence");
  const now=Date.now();
  const runs=prior.runs.filter(r=>r.runId!==runId &&
    r.codeFingerprint===codeFingerprint && r.verifiedAt &&
    Date.parse(r.verifiedAt)<=now && now-Date.parse(r.verifiedAt)<=MAX_AGE_MS);
  runs.push(run);
  const uniqueDeployments=new Set(runs.map(r=>r.deploymentId)).size===runs.length;
  const uniqueRuns=new Set(runs.map(r=>r.runId)).size===runs.length;
  const scenarios=new Set(runs.filter(verifiedScenario).map(r=>r.scenario));
  const passed=uniqueRuns && uniqueDeployments && SCENARIOS.every(s=>scenarios.has(s));
  const result={schemaVersion:GATE_VERSION,status:passed?"passed":"incomplete",
    validatedRuns:runs.map(r=>r.runId),runs};
  await mkdir(dirname(path),{recursive:true});
  const temp=path+"."+runId+".tmp";
  try{await writeFile(temp,JSON.stringify(result,null,2)+"\n");await rename(temp,path);}
  finally{await rm(temp,{force:true});}
  return result;
}
