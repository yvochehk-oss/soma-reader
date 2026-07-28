// Web Crypto API (AES-GCM) Protected Offline Encryption & IndexedDB Manager

const DB_NAME = 'soma_offline_encrypted_db';
const DB_VERSION = 1;
const STORE_NAME = 'encrypted_chapters';
const KEY_STORE_NAME = 'crypto_keys';

export interface EncryptedChapterData {
  bookId: string;
  chapterId: string;
  iv: number[]; // Store IV array
  ciphertext: number[]; // Store encrypted bytes
  downloadedAt: string;
  title: string;
  wordCount: number;
}

// Helper to open IndexedDB
function openOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: ['bookId', 'chapterId'] });
      }
      if (!db.objectStoreNames.contains(KEY_STORE_NAME)) {
        db.createObjectStore(KEY_STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Get or create persistent CryptoKey for local encryption
async function getOrCreateEncryptionKey(): Promise<CryptoKey> {
  const db = await openOfflineDB();
  
  // Try retrieving existing exported key raw bytes
  const existingKeyBytes = await new Promise<number[] | null>((resolve) => {
    const tx = db.transaction(KEY_STORE_NAME, 'readonly');
    const store = tx.objectStore(KEY_STORE_NAME);
    const req = store.get('soma_client_secret_key');
    req.onsuccess = () => resolve(req.result ? req.result.rawKey : null);
    req.onerror = () => resolve(null);
  });

  if (existingKeyBytes) {
    const keyBuffer = new Uint8Array(existingKeyBytes);
    return await window.crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  } else {
    // Generate new 256-bit AES-GCM Key
    const key = await window.crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true, // exportable so we can persist in DB
      ['encrypt', 'decrypt']
    );
    const rawExport = await window.crypto.subtle.exportKey('raw', key);
    const rawArray = Array.from(new Uint8Array(rawExport));

    // Store key in DB
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(KEY_STORE_NAME, 'readwrite');
      const store = tx.objectStore(KEY_STORE_NAME);
      const req = store.put({ id: 'soma_client_secret_key', rawKey: rawArray });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    return key;
  }
}

// Encrypt & store book chapters
export async function saveChapterOfflineEncrypted(
  bookId: string,
  chapterId: string,
  chapterTitle: string,
  plainTextContent: string,
  wordCount: number
): Promise<void> {
  const key = await getOrCreateEncryptionKey();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const data = encoder.encode(plainTextContent);

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  const db = await openOfflineDB();
  const record: EncryptedChapterData = {
    bookId,
    chapterId,
    iv: Array.from(iv),
    ciphertext: Array.from(new Uint8Array(ciphertextBuffer)),
    downloadedAt: new Date().toISOString(),
    title: chapterTitle,
    wordCount,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Decrypt & read chapter
export async function getDecryptedChapterOffline(
  bookId: string,
  chapterId: string
): Promise<string | null> {
  try {
    const db = await openOfflineDB();
    const record = await new Promise<EncryptedChapterData | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get([bookId, chapterId]);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });

    if (!record) return null;

    const key = await getOrCreateEncryptionKey();
    const iv = new Uint8Array(record.iv);
    const ciphertext = new Uint8Array(record.ciphertext);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (err) {
    console.error('Failed to decrypt chapter offline:', err);
    return null;
  }
}

// Check if all chapters of a book are downloaded offline
export async function getOfflineBookStatus(bookId: string): Promise<{
  isOfflineAvailable: boolean;
  downloadedCount: number;
}> {
  const db = await openOfflineDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      const all: EncryptedChapterData[] = req.result || [];
      const bookChapters = all.filter((c) => c.bookId === bookId);
      resolve({
        isOfflineAvailable: bookChapters.length > 0,
        downloadedCount: bookChapters.length,
      });
    };
    req.onerror = () => resolve({ isOfflineAvailable: false, downloadedCount: 0 });
  });
}

// Remove offline downloaded chapters for a book
export async function deleteOfflineBook(bookId: string): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAllKeys();
    req.onsuccess = () => {
      const keys: any[] = req.result || [];
      keys.forEach((k) => {
        if (Array.isArray(k) && k[0] === bookId) {
          store.delete(k);
        }
      });
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

// List all offline books summary
export async function getAllOfflineBooksSummary(): Promise<
  { bookId: string; count: number; totalBytes: number }[]
> {
  const db = await openOfflineDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      const all: EncryptedChapterData[] = req.result || [];
      const map = new Map<string, { count: number; bytes: number }>();

      all.forEach((item) => {
        const curr = map.get(item.bookId) || { count: 0, bytes: 0 };
        curr.count += 1;
        curr.bytes += item.ciphertext.length + item.iv.length;
        map.set(item.bookId, curr);
      });

      const res = Array.from(map.entries()).map(([bookId, val]) => ({
        bookId,
        count: val.count,
        totalBytes: val.bytes,
      }));
      resolve(res);
    };
    req.onerror = () => resolve([]);
  });
}
