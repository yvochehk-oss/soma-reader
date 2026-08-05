#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const apiIndex = process.argv.indexOf("--api-url");
const apiUrl = apiIndex >= 0 && process.argv[apiIndex + 1]
  ? process.argv[apiIndex + 1]
  : "https://read.20140128.xyz/api/internal/book-import";

const token = process.env.SOMA_IMPORT_TOKEN || execFileSync(
  "security",
  ["find-generic-password", "-s", "Soma Book Import Token", "-w"],
  { encoding: "utf8" },
).trim();
if (!token) throw new Error("No import token found. Set SOMA_IMPORT_TOKEN or save it in Keychain as 'Soma Book Import Token'.");

const response = await fetch(apiUrl, { method: "DELETE", headers: { authorization: `Bearer ${token}` } });
const result = await response.json().catch(() => ({}));
if (!response.ok) throw new Error(`Delete failed (${response.status}): ${result.error ?? "Unknown error"}`);
console.log(`Deleted ${result.deletedBooks ?? 0} book(s) and ${result.deletedCovers ?? 0} cover file(s).`);
