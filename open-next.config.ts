import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

export default defineCloudflareConfig({
  // The first deployment stays R2-free so it works on accounts where R2 has not been enabled yet.
  incrementalCache: staticAssetsIncrementalCache,
});
