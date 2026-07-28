// Zero-Server Client-Side TXT / EPUB Book Parser & Local IndexedDB Library Store
import JSZip from 'jszip';
import { Book, Chapter } from '../types';

const LOCAL_DB_NAME = 'soma_local_imported_library_db';
const LOCAL_DB_VERSION = 1;
const LOCAL_STORE = 'imported_books';

function openLocalDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LOCAL_DB_NAME, LOCAL_DB_VERSION);
    request.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(LOCAL_STORE)) {
        db.createObjectStore(LOCAL_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Generate dynamic cover SVG/Canvas data URL for local imported books without covers
export function generateDefaultCover(title: string, author: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 600;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // Rich gradient background
    const grad = ctx.createLinearGradient(0, 0, 400, 600);
    grad.addColorStop(0, '#0a1f1d');
    grad.addColorStop(0.5, '#182625');
    grad.addColorStop(1, '#a43d17');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 400, 600);

    // Decorative inner frame
    ctx.strokeStyle = '#dec0b7';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, 360, 560);

    // Badge
    ctx.fillStyle = '#ed7248';
    ctx.beginPath();
    ctx.roundRect(30, 40, 140, 28, 14);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('LOCAL FILE', 45, 58);

    // Title
    ctx.fillStyle = '#F8F7F2';
    ctx.font = 'bold 26px Georgia, serif';

    // Multi-line wrap
    const words = title.split(' ');
    let line = '';
    let y = 220;
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > 320 && n > 0) {
        ctx.fillText(line, 40, y);
        line = words[n] + ' ';
        y += 36;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, 40, y);

    // Author
    ctx.fillStyle = '#d0e7e4';
    ctx.font = 'italic 18px Georgia, serif';
    ctx.fillText('By ' + (author || 'Local Author'), 40, y + 60);

    // Platform stamp
    ctx.fillStyle = '#dec0b7';
    ctx.font = '12px sans-serif';
    ctx.fillText('Soma Reader • Zero Upload', 40, 540);
  }

  return canvas.toDataURL('image/png');
}

// Parse TXT file into Book structure with intelligent chapter detection
export function parseTxtFile(file: File, textContent: string): Book {
  const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
  
  // Chapter detection Regex patterns:
  // English: Chapter 1, Chapter One, CHAPTER 1, Part 1, Section 1
  // Kiswahili: Sura ya 1, Sura ya Kwanza, SURA YA 1
  // Chinese: 第1章, 第一章
  const chapterRegex = /(?:\r?\n)+(?=(?:Chapter|CHAPTER|Sura|SURA|Sura ya|SURA YA|Part|PART|Section|第[0-9一二三四五六七八九十]+\s*[章卷])\s+[0-9A-Za-z一二三四五六七八九十IVXLCDM]+\b|[0-9]+\.\s+[A-Z])/gi;

  const rawChunks = textContent.split(chapterRegex);
  const chapters: Chapter[] = [];

  if (rawChunks.length > 1) {
    let chIndex = 1;
    for (const chunk of rawChunks) {
      const trimmed = chunk.trim();
      if (!trimmed) continue;

      // Extract title from first line
      const lines = trimmed.split(/\r?\n/);
      const titleLine = lines[0].slice(0, 80).trim();
      const bodyText = lines.slice(1).join('\n').trim() || trimmed;

      const words = trimmed.split(/\s+/).length;

      chapters.push({
        id: `txt-ch-${chIndex}`,
        number: chIndex,
        title: titleLine || `Chapter ${chIndex}`,
        content: bodyText,
        wordCount: words,
        releaseDate: new Date().toISOString().split('T')[0],
      });
      chIndex++;
    }
  }

  // Fallback: If no chapter headers detected, chunk every ~1200 words
  if (chapters.length === 0) {
    const words = textContent.trim().split(/\s+/);
    const chunkSize = 1200;
    let chIndex = 1;

    for (let i = 0; i < words.length; i += chunkSize) {
      const chunkWords = words.slice(i, i + chunkSize);
      const content = chunkWords.join(' ');
      chapters.push({
        id: `txt-ch-${chIndex}`,
        number: chIndex,
        title: `Section ${chIndex}`,
        content,
        wordCount: chunkWords.length,
        releaseDate: new Date().toISOString().split('T')[0],
      });
      chIndex++;
    }
  }

  const bookId = 'local-txt-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  const totalWords = chapters.reduce((acc, c) => acc + c.wordCount, 0);

  return {
    id: bookId,
    title: fileNameWithoutExt,
    author: 'Local File Import',
    category: 'Local eBook',
    rating: 5.0,
    heatMetric: `${Math.round(totalWords / 1000)}k words`,
    description: `Local TXT ebook imported directly in browser memory. Zero network upload. Contains ${chapters.length} chapters.`,
    coverImage: generateDefaultCover(fileNameWithoutExt, 'Local TXT Import'),
    status: 'Free',
    chaptersCount: chapters.length,
    chapters,
    publishedYear: new Date().getFullYear().toString(),
    tags: ['LocalImport', 'TXT', 'ZeroUpload'],
  };
}

// Parse EPUB file using JSZip
export async function parseEpubFile(file: File): Promise<Book> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  // 1. Locate container.xml
  const containerFile = zip.file('META-INF/container.xml');
  if (!containerFile) {
    throw new Error('Invalid EPUB file: Missing META-INF/container.xml');
  }

  const containerXml = await containerFile.async('text');
  const parser = new DOMParser();
  const containerDoc = parser.parseFromString(containerXml, 'application/xml');
  const rootfileEl = containerDoc.querySelector('rootfile');
  const opfPath = rootfileEl?.getAttribute('full-path');

  if (!opfPath) {
    throw new Error('Invalid EPUB file: Unable to locate package OPF path');
  }

  // 2. Read OPF file
  const opfFile = zip.file(opfPath);
  if (!opfFile) {
    throw new Error(`Invalid EPUB file: Missing OPF file at ${opfPath}`);
  }

  const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';
  const opfXml = await opfFile.async('text');
  const opfDoc = parser.parseFromString(opfXml, 'application/xml');

  // Extract Metadata
  const titleEl = opfDoc.querySelector('title') || opfDoc.querySelector('dc\\:title');
  const authorEl = opfDoc.querySelector('creator') || opfDoc.querySelector('dc\\:creator');
  const title = titleEl?.textContent?.trim() || file.name.replace(/\.epub$/i, '');
  const author = authorEl?.textContent?.trim() || 'EPUB Author';

  // Read Spine & Manifest
  const manifestItems = Array.from(opfDoc.querySelectorAll('manifest > item'));
  const manifestMap = new Map<string, { href: string; mediaType: string }>();

  manifestItems.forEach((item) => {
    const id = item.getAttribute('id');
    const href = item.getAttribute('href');
    const mediaType = item.getAttribute('media-type');
    if (id && href) {
      manifestMap.set(id, { href, mediaType: mediaType || '' });
    }
  });

  // Cover image extraction
  let coverDataUrl: string | null = null;
  const coverMeta = opfDoc.querySelector('meta[name="cover"]');
  const coverId = coverMeta?.getAttribute('content');
  if (coverId && manifestMap.has(coverId)) {
    const coverHref = manifestMap.get(coverId)!.href;
    const coverPath = opfDir + coverHref;
    const coverZipFile = zip.file(coverPath);
    if (coverZipFile) {
      const base64 = await coverZipFile.async('base64');
      const mime = manifestMap.get(coverId)?.mediaType || 'image/jpeg';
      coverDataUrl = `data:${mime};base64,${base64}`;
    }
  }

  // Fallback cover search
  if (!coverDataUrl) {
    for (const [id, item] of manifestMap.entries()) {
      if (item.mediaType.startsWith('image/') && (id.includes('cover') || item.href.includes('cover'))) {
        const imgFile = zip.file(opfDir + item.href);
        if (imgFile) {
          const base64 = await imgFile.async('base64');
          coverDataUrl = `data:${item.mediaType};base64,${base64}`;
          break;
        }
      }
    }
  }

  if (!coverDataUrl) {
    coverDataUrl = generateDefaultCover(title, author);
  }

  // Read Spine order HTMLs
  const spineItems = Array.from(opfDoc.querySelectorAll('spine > itemref'));
  const chapters: Chapter[] = [];
  let chIndex = 1;

  for (const itemref of spineItems) {
    const idref = itemref.getAttribute('idref');
    if (!idref || !manifestMap.has(idref)) continue;

    const manifestItem = manifestMap.get(idref)!;
    const fullHref = opfDir + manifestItem.href;
    const htmlFile = zip.file(fullHref);

    if (!htmlFile) continue;

    const htmlText = await htmlFile.async('text');
    const doc = parser.parseFromString(htmlText, 'text/html');

    // Remove scripts and style tags
    doc.querySelectorAll('script, style').forEach((node) => node.remove());

    // Extract chapter title
    const headerTitle =
      doc.querySelector('h1, h2, h3, title')?.textContent?.trim() || `Chapter ${chIndex}`;

    // Extract text paragraphs
    const paragraphs = Array.from(doc.querySelectorAll('p, div, section'))
      .map((p) => p.textContent?.trim())
      .filter((t) => t && t.length > 5);

    const fullContent =
      paragraphs.length > 0 ? paragraphs.join('\n\n') : doc.body.textContent?.trim() || '';

    if (fullContent.length < 50) continue; // Skip minor/empty TOC pages

    const wordCount = fullContent.split(/\s+/).length;

    chapters.push({
      id: `epub-ch-${chIndex}`,
      number: chIndex,
      title: headerTitle,
      content: fullContent,
      wordCount,
      releaseDate: new Date().toISOString().split('T')[0],
    });

    chIndex++;
  }

  if (chapters.length === 0) {
    throw new Error('Unable to extract readable chapters from EPUB content spine.');
  }

  const bookId = 'local-epub-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);

  return {
    id: bookId,
    title,
    author,
    category: 'Local EPUB',
    rating: 5.0,
    heatMetric: `${chapters.length} Chapters`,
    description: `Imported EPUB book (${file.name}). Zero server upload - stored 100% locally in browser IndexedDB.`,
    coverImage: coverDataUrl,
    status: 'Free',
    chaptersCount: chapters.length,
    chapters,
    publishedYear: new Date().getFullYear().toString(),
    tags: ['LocalImport', 'EPUB', 'ZeroUpload'],
  };
}

// Storage helpers for Local Imported Library in IndexedDB
export async function saveLocalImportedBook(book: Book): Promise<void> {
  const db = await openLocalDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LOCAL_STORE, 'readwrite');
    const store = tx.objectStore(LOCAL_STORE);
    const req = store.put(book);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getAllLocalImportedBooks(): Promise<Book[]> {
  const db = await openLocalDB();
  return new Promise((resolve) => {
    const tx = db.transaction(LOCAL_STORE, 'readonly');
    const store = tx.objectStore(LOCAL_STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
}

export async function deleteLocalImportedBook(bookId: string): Promise<void> {
  const db = await openLocalDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LOCAL_STORE, 'readwrite');
    const store = tx.objectStore(LOCAL_STORE);
    const req = store.delete(bookId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
