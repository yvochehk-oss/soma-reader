import { execFileSync } from "node:child_process";

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const IMPORT_TOKEN_ENV_NAMES = ["SOMA_IMPORT_TOKEN", "BOOK_IMPORT_TOKEN"];

function keychainImportToken() {
  try {
    return execFileSync("security", ["find-generic-password", "-s", "Soma Book Import Token", "-w"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

export function getImportToken() {
  for (const name of IMPORT_TOKEN_ENV_NAMES) {
    if (process.env[name]) return process.env[name];
  }
  return keychainImportToken();
}

function retryDelay(response, attempt) {
  const retryAfter = Number(response?.headers?.get?.("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter >= 0) return Math.min(retryAfter * 1_000, 15_000);
  return Math.min(500 * (2 ** attempt), 8_000);
}

export async function fetchJsonWithRetry(url, init = {}, options = {}) {
  const attempts = options.attempts ?? 5;
  const label = options.label ?? "Request";
  const method = (init.method || "GET").toUpperCase();
  const headers = new Headers(init.headers);
  const token = (headers.get("authorization") || "").replace(/^Bearer\s+/i, "") || getImportToken();
  const body = init.body || "";

  headers.set("Accept", "application/json");
  headers.set("User-Agent", "SomaReleaseAudit/1.0");
  if (token && !headers.has("authorization")) headers.set("Authorization", `Bearer ${token}`);
  if (body && !headers.has("content-type")) headers.set("Content-Type", "application/json");

  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const fetchedResponse = await fetch(url, { method, headers, body: body || undefined });
      const bodyText = (await fetchedResponse.text()).trim();
      const statusCode = fetchedResponse.status;

      let result = {};
      try {
        result = JSON.parse(bodyText);
      } catch {
        result = { error: bodyText.slice(0, 300) };
      }

      const response = {
        ok: statusCode >= 200 && statusCode < 300,
        status: statusCode,
        statusText: fetchedResponse.statusText || `HTTP ${statusCode}`,
        headers: fetchedResponse.headers,
      };

      if (response.ok || !RETRYABLE_STATUS.has(statusCode) || attempt === attempts - 1) {
        return { response, result, attempts: attempt + 1 };
      }
      console.warn(`${label} returned ${statusCode}; retrying (${attempt + 2}/${attempts}).`);
      await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) break;
      console.warn(`${label} failed temporarily; retrying (${attempt + 2}/${attempts}).`);
      await new Promise((resolve) => setTimeout(resolve, retryDelay(null, attempt)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`${label} failed after ${attempts} attempts.`);
}
