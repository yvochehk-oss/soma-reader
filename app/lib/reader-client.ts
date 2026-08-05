"use client";

import { encryptOfflineContent, decryptOfflineContent } from "@/app/lib/local-storage-encryption";

const ANONYMOUS_ID_KEY = "soma-anonymous-id";

export function supabaseIsConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function anonymousId() {
  let value = localStorage.getItem(ANONYMOUS_ID_KEY);
  if (!value) {
    value = crypto.randomUUID();
    localStorage.setItem(ANONYMOUS_ID_KEY, value);
  }
  return value;
}

export async function trackEvent(input: {
  eventType: "book_view" | "chapter_start" | "chapter_25" | "chapter_50" | "chapter_75" | "chapter_complete" | "bookshelf_add" | "offline_download";
  bookId?: string;
  chapterId?: string;
  readingSeconds?: number;
}) {
  if (!supabaseIsConfigured()) return;
  try {
    await fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...input, anonymousId: anonymousId() }),
      keepalive: true,
    });
  } catch {
    // Analytics must never interrupt reading.
  }
}

export type DownloadedChapter = {
  key: string;
  bookSlug: string;
  chapterNumber: number;
  title: string;
  content: string;
  downloadedAt: string;
};

const DB_NAME = "soma-offline";
const STORE = "chapters";

function db() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "key" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveDownloadedChapter(chapter: DownloadedChapter) {
  const database = await db();
  const encryptedChapter = {
    ...chapter,
    content: encryptOfflineContent(chapter.content, chapter.bookSlug),
  };
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(encryptedChapter);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function listDownloadedChapters() {
  const database = await db();
  const chapters = await new Promise<DownloadedChapter[]>((resolve, reject) => {
    const request = database.transaction(STORE).objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result as DownloadedChapter[]);
    request.onerror = () => reject(request.error);
  });
  database.close();
  
  // Decrypt contents for Soma internal reader
  const decrypted = chapters.map((ch) => ({
    ...ch,
    content: decryptOfflineContent(ch.content, ch.bookSlug),
  }));

  return decrypted.sort((a, b) => b.downloadedAt.localeCompare(a.downloadedAt));
}

export async function deleteOfflineBook(bookSlug: string) {
  const chapters = await listDownloadedChapters();
  const database = await db();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE, "readwrite");
    chapters.filter((chapter) => chapter.bookSlug === bookSlug).forEach((chapter) => transaction.objectStore(STORE).delete(chapter.key));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export function cacheReaderUrls(urls: string[]) {
  navigator.serviceWorker?.controller?.postMessage({ type: "CACHE_READER_URLS", urls });
}
