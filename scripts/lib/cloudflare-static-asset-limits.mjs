import { readdir, stat } from "node:fs/promises";
import { relative, resolve } from "node:path";

export const CLOUDFLARE_STATIC_ASSET_LIMITS = Object.freeze({
  maxFiles: 20_000,
  maxFileBytes: 25 * 1024 * 1024,
});

function formatMiB(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

export async function assertCloudflareStaticAssetLimits(directory, limits = {}) {
  const requestedMaxFiles = limits.maxFiles ?? CLOUDFLARE_STATIC_ASSET_LIMITS.maxFiles;
  const requestedMaxFileBytes = limits.maxFileBytes ?? CLOUDFLARE_STATIC_ASSET_LIMITS.maxFileBytes;
  if (!Number.isSafeInteger(requestedMaxFiles) || requestedMaxFiles < 1) throw new Error("Cloudflare asset maxFiles must be a positive safe integer.");
  if (!Number.isSafeInteger(requestedMaxFileBytes) || requestedMaxFileBytes < 1) throw new Error("Cloudflare asset maxFileBytes must be a positive safe integer.");
  const maxFiles = Math.min(requestedMaxFiles, CLOUDFLARE_STATIC_ASSET_LIMITS.maxFiles);
  const maxFileBytes = Math.min(requestedMaxFileBytes, CLOUDFLARE_STATIC_ASSET_LIMITS.maxFileBytes);

  const root = resolve(directory);
  let files = 0;
  let totalBytes = 0;
  let largestFile = null;
  let oversizedFileCount = 0;
  const oversizedExamples = [];

  // Count regular files only. Wrangler's "Read N files" diagnostic is based
  // on recursive readdir entries, which also include directory names.
  async function visit(current) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const path = resolve(current, entry.name);
      if (entry.isDirectory()) {
        await visit(path);
        continue;
      }
      if (!entry.isFile()) {
        throw new Error(`Cloudflare asset tree contains a non-regular entry; refusing to skip it: ${relative(root, path)}`);
      }

      const file = await stat(path);
      if (!file.isFile()) {
        throw new Error(`Cloudflare asset changed during inspection; refusing to count it: ${relative(root, path)}`);
      }
      files += 1;
      totalBytes += file.size;
      if (!largestFile || file.size > largestFile.bytes) largestFile = { path: relative(root, path), bytes: file.size };
      if (file.size > maxFileBytes) {
        oversizedFileCount += 1;
        if (oversizedExamples.length < 5) oversizedExamples.push(`${relative(root, path)} (${formatMiB(file.size)})`);
      }
    }
  }

  await visit(root);

  const violations = [];
  if (files > maxFiles) violations.push(`${files} files exceed the ${maxFiles}-file limit.`);
  if (oversizedFileCount) {
    const examples = oversizedExamples.join(", ");
    violations.push(`${oversizedFileCount} file(s) exceed the ${formatMiB(maxFileBytes)} per-file limit${examples ? `; examples: ${examples}` : ""}.`);
  }
  if (violations.length) {
    throw new Error(`Cloudflare static asset limits exceeded in ${root}: ${violations.join(" ")}`);
  }

  return {
    files,
    totalBytes,
    largestFile,
    limits: { maxFiles, maxFileBytes },
    cloudflareMaxFiles: CLOUDFLARE_STATIC_ASSET_LIMITS.maxFiles,
    remainingFiles: Math.max(0, maxFiles - files),
  };
}
