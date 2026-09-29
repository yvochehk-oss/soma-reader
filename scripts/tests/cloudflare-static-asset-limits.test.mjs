import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  assertCloudflareStaticAssetLimits,
  CLOUDFLARE_STATIC_ASSET_LIMITS,
} from "../lib/cloudflare-static-asset-limits.mjs";

test("Cloudflare asset scanner uses the free-tier file-count and per-file byte ceilings", () => {
  assert.deepEqual(CLOUDFLARE_STATIC_ASSET_LIMITS, {
    maxFiles: 20_000,
    maxFileBytes: 25 * 1024 * 1024,
  });
});

test("Cloudflare asset scanner counts the full nested tree and rejects file-count overflow", async () => {
  const root = await mkdtemp(join(tmpdir(), "soma-assets-count-"));
  try {
    await mkdir(join(root, "nested"));
    await writeFile(join(root, "index.html"), "abc");
    await writeFile(join(root, "nested", "chapter.html"), "defg");

    await assert.rejects(
      assertCloudflareStaticAssetLimits(root, { maxFiles: 1, maxFileBytes: 10 }),
      /2 files exceed the 1-file limit/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Cloudflare asset scanner rejects a single file that exceeds the byte ceiling", async () => {
  const root = await mkdtemp(join(tmpdir(), "soma-assets-size-"));
  try {
    await writeFile(join(root, "oversized.json"), "12345");

    await assert.rejects(
      assertCloudflareStaticAssetLimits(root, { maxFiles: 5, maxFileBytes: 4 }),
      /1 file\(s\) exceed the 0\.00 MiB per-file limit; examples: oversized\.json/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Cloudflare asset scanner reports complete totals for a tree within limits", async () => {
  const root = await mkdtemp(join(tmpdir(), "soma-assets-ok-"));
  try {
    await mkdir(join(root, "nested"));
    await writeFile(join(root, "index.html"), "abc");
    await writeFile(join(root, "nested", "chapter.html"), "defg");

    assert.deepEqual(await assertCloudflareStaticAssetLimits(root, { maxFiles: 2, maxFileBytes: 4 }), {
      files: 2,
      totalBytes: 7,
      largestFile: { path: "nested/chapter.html", bytes: 4 },
      limits: { maxFiles: 2, maxFileBytes: 4 },
      cloudflareMaxFiles: 20_000,
      remainingFiles: 0,
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Cloudflare 20,000-file boundary passes exactly at the cap and rejects the next file", async () => {
  const root = await mkdtemp(join(tmpdir(), "soma-assets-boundary-"));
  try {
    await mkdir(join(root, "nested"));
    await writeFile(join(root, "one.txt"), "1");
    await writeFile(join(root, "nested", "two.txt"), "2");

    const atLimit = await assertCloudflareStaticAssetLimits(root, { maxFiles: 2, maxFileBytes: 4 });
    assert.equal(atLimit.files, 2);
    assert.equal(atLimit.remainingFiles, 0);
    await writeFile(join(root, "three.txt"), "3");
    await assert.rejects(
      assertCloudflareStaticAssetLimits(root, { maxFiles: 2, maxFileBytes: 4 }),
      /3 files exceed the 2-file limit/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Cloudflare asset scanner never permits a caller-supplied file cap above 20,000", async () => {
  const root = await mkdtemp(join(tmpdir(), "soma-assets-hard-cap-"));
  try {
    await writeFile(join(root, "index.html"), "x");
    const result = await assertCloudflareStaticAssetLimits(root, { maxFiles: 20_001, maxFileBytes: 1 });
    assert.equal(result.limits.maxFiles, 20_000);
    assert.equal(result.cloudflareMaxFiles, 20_000);
    assert.equal(result.remainingFiles, 19_999);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
