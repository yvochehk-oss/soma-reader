"use client";

// Client-side encryption & packaging for offline downloaded chapters
const SOMA_SALT = "soma-reader-secure-key-2026";

function getCipherKey(bookSlug: string) {
  let hash = 0;
  const str = `${bookSlug}-${SOMA_SALT}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function encryptOfflineContent(content: string, bookSlug: string): string {
  const cipherKey = getCipherKey(bookSlug);
  const encoded = encodeURIComponent(content);
  const result: number[] = [];
  for (let i = 0; i < encoded.length; i++) {
    result.push(encoded.charCodeAt(i) ^ (cipherKey % 255));
  }
  return btoa(String.fromCharCode(...result));
}

export function decryptOfflineContent(encrypted: string, bookSlug: string): string {
  try {
    const cipherKey = getCipherKey(bookSlug);
    const raw = atob(encrypted);
    const result: number[] = [];
    for (let i = 0; i < raw.length; i++) {
      result.push(raw.charCodeAt(i) ^ (cipherKey % 255));
    }
    const decoded = String.fromCharCode(...result);
    return decodeURIComponent(decoded);
  } catch {
    // Return placeholder if tampered
    return "Content protected by Soma Secure Package. Open within Soma Reader.";
  }
}
