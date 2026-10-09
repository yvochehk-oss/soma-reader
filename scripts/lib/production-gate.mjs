import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import {buildFingerprint} from "./build-fingerprint.mjs";
import {assertPreviewPromotionGate} from "./preview-gates.mjs";

// One strict preflight for both the release uploader and the deploy coordinator.
// A failed gate must stop *before* writing books into the production database.
export async function assertProductionDataGate(root, buildEnv) {
  const fingerprint=await buildFingerprint(root,buildEnv);
  const approval=await readFile(resolve(root,".soma-deploy-state/preview-gates.json"),"utf8")
    .then(JSON.parse).catch(error=>{
      if(error.code==="ENOENT")return null;
      throw error;
    });
  return assertPreviewPromotionGate(approval,fingerprint.codeFingerprint);
}
