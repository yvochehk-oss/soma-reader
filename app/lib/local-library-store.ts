"use client";

import type { ParsedLocalBook } from "@/app/lib/local-book-parser";

export type StoredLocalBook = {
  id: string;
  slug: string;
  title: string;
  author: string;
  format: "txt" | "epub";
  description: string;
  chaptersCount: number;
  chapters: Array<{ number: number; title: string; content: string }>;
  addedAt: string;
};

const DB_NAME = "soma-local-library";
const STORE = "local_books";

function getDB() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function slugify(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || `local-book-${Date.now()}`;
}

export async function saveLocalBook(parsed: ParsedLocalBook): Promise<StoredLocalBook> {
  const db = await getDB();
  const id = `local_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const slug = slugify(parsed.title);

  const record: StoredLocalBook = {
    id,
    slug,
    title: parsed.title,
    author: parsed.author,
    format: parsed.format,
    description: parsed.description,
    chaptersCount: parsed.chapters.length,
    chapters: parsed.chapters,
    addedAt: new Date().toISOString(),
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  db.close();
  return record;
}

export async function listLocalBooks(): Promise<StoredLocalBook[]> {
  const db = await getDB();
  const books = await new Promise<StoredLocalBook[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as StoredLocalBook[]);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return books.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
}

export async function getLocalBookBySlug(slug: string): Promise<StoredLocalBook | null> {
  const books = await listLocalBooks();
  return books.find((b) => b.slug === slug || b.id === slug) || null;
}

export async function deleteLocalBook(id: string): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
