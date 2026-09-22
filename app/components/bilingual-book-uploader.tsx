"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Language = "en" | "sw";
type Chapter = { number: number; title: string; content: string; status: "draft" | "published"; isFree: boolean };
type PreparedBook = { slug: string; title: string; author: string; language: Language; category: string; tags: string[]; description: string; status: "draft" | "published"; coverDataUrl: string; chapters: Chapter[]; translationOfSlug?: string; group: string; originalSlug: string; explicitParent?: string };
type StoryMeta = { title?: string; title_original?: string; author?: string; language?: string; description?: string; category?: string; tags?: string[]; translation_of_slug?: string; translationOfSlug?: string };
type DirectoryFile = File & { webkitRelativePath?: string };

const SOMA_CATEGORIES = ["Romance", "Thriller", "Sci-Fi", "Historical", "Fantasy", "Contemporary", "Urban Fantasy"];
function normalizedTags(value: unknown) { return Array.isArray(value) ? [...new Map(value.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean).map((tag) => [tag.toLowerCase(), tag])).values()] : []; }
function publicationMetadataMissing(book: PreparedBook) { return !book.description.trim() || !SOMA_CATEGORIES.includes(book.category) || !book.tags.length || book.tags.length > 12 || book.tags.some((tag) => tag.length > 40); }

function slugify(value: string) { const output = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); return output || `soma-story-${crypto.randomUUID().slice(0, 8)}`; }
function fileDataUrl(file: File) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read cover image.")); reader.onerror = () => reject(new Error(`Could not read ${file.name}.`)); reader.readAsDataURL(file); }); }
const EN_NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const SW_NUMBERS: Record<string, number> = { kwanza: 1, moja: 1, pili: 2, mbili: 2, tatu: 3, nne: 4, tano: 5, sita: 6, saba: 7, nane: 8, tisa: 9, kumi: 10, ishirini: 20, thelathini: 30, arobaini: 40, hamsini: 50, sitini: 60, sabini: 70, themanini: 80, tisini: 90 };
function chapterNumber(value: string, language: Language) { const normalized = value.toLowerCase().replace(/[-–—]/g, " ").replace(/\s+/g, " ").trim(); if (/^\d+$/.test(normalized)) return Number(normalized); const words = normalized.split(" "); if (language === "en") { if (EN_NUMBERS[normalized]) return EN_NUMBERS[normalized]; if (words.length === 2 && EN_NUMBERS[words[0]] >= 20 && EN_NUMBERS[words[1]] < 10) return EN_NUMBERS[words[0]] + EN_NUMBERS[words[1]]; if (normalized === "one hundred") return 100; return null; } if (SW_NUMBERS[normalized]) return SW_NUMBERS[normalized]; const compound = /^(kumi|ishirini|thelathini|arobaini|hamsini|sitini|sabini|themanini|tisini) na (moja|mbili|tatu|nne|tano|sita|saba|nane|tisa)$/.exec(normalized); if (compound) return SW_NUMBERS[compound[1]] + SW_NUMBERS[compound[2]]; return normalized === "mia moja" ? 100 : null; }
function parseChapters(markdown: string, language: Language, status: "draft" | "published") { const body = markdown.replace(/\r\n?/g, "\n").replace(/^---[\s\S]*?---\s*/, "").trim(); const lines = body.split("\n"); const headings: Array<{ index: number; length: number; number: number; title: string }> = []; let offset = 0; for (const line of lines) { const match = /^(?:(#{1,6})\s+)?(?:Sura(?:\s+ya)?|Chapter)\s+(.+?)\s*$/i.exec(line.trim()); if (match) { const separator = match[2].search(/\s*[:：]\s*/); let numberText = separator >= 0 ? match[2].slice(0, separator).trim() : match[2].trim(); let title = separator >= 0 ? match[2].slice(separator).replace(/^\s*[:：]\s*/, "").trim() : ""; const decimal = separator < 0 ? /^(\d+)\s+(.+)$/.exec(match[2]) : null; if (decimal) { numberText = decimal[1]; title = decimal[2].trim(); } const number = chapterNumber(numberText, language); if (number && (match[1] || separator >= 0)) headings.push({ index: offset, length: line.length, number, title }); } offset += line.length + 1; } return headings.map((heading, index) => { const content = body.slice(heading.index + heading.length, headings[index + 1]?.index).trim(); return { number: heading.number, title: heading.title || (language === "sw" ? `Sura ya ${heading.number}` : `Chapter ${heading.number}`), content, status, isFree: true }; }).filter((chapter) => chapter.content); }
function inferLanguage(source: string, name: string): Language | null { const lower = name.toLowerCase(); if (/(?:^|[_\-.])en(?:[_\-.]|$)|english/.test(lower)) return "en"; if (/(?:^|[_\-.])sw(?:[_\-.]|$)|swahili|kiswahili/.test(lower)) return "sw"; return /^\s*(?:#{1,6}\s+)?Chapter\s+/im.test(source) ? "en" : /^\s*(?:#{1,6}\s+)?Sura(?:\s+ya)?\s+/im.test(source) ? "sw" : null; }
function inferTitle(source: string, name: string) { const heading = source.match(/^#\s+(.+)$/m)?.[1]?.trim(); const value = heading && !/^(?:Chapter|Sura(?:\s+ya)?)\b/i.test(heading) ? heading : name.replace(/\.(?:md|txt)$/i, "").replace(/(?:_final)?_(?:en|sw)(?:_final)?(?:_expanded)?(?:_v\d+(?:_\d+)*)?$/i, "").replace(/_/g, " "); return value.toLowerCase().replace(/\b\p{L}/gu, (letter) => letter.toUpperCase()); }
function manuscriptScore(name: string) { const lower = name.toLowerCase(); if (!/\.(?:md|txt)$/.test(lower) || /(report|audit|outline|bible|concept|synopsis|ledger|notes|readme|validation|prompt|narration)/.test(lower)) return -1; return (/final/.test(lower) ? 100 : 0) + (/(?:_final_(?:en|sw)|_(?:en|sw)_final)/.test(lower) ? 100 : 0) + (/full_story/.test(lower) ? 20 : 0) + (/\.md$/.test(lower) ? 5 : 0); }
function coverScore(file: DirectoryFile, language: Language) { const path = (file.webkitRelativePath || file.name).toLowerCase(); const name = file.name.toLowerCase(); if (!/\.(?:jpe?g|png|webp)$/.test(name) || /(promo|video|frame|caption|contact.sheet)/.test(path)) return -1; let score = /cover/.test(name) ? 30 : 0; if (language === "en" && (/(?:^|[_\-.])en(?:[_\-.]|$)/.test(name) || /english/.test(name))) score += 50; if (language === "sw" && (/(?:^|[_\-.])sw(?:[_\-.]|$)/.test(name) || /swahili|kiswahili/.test(name))) score += 50; if (language === "en" && /(?:^|[_\-.])sw(?:[_\-.]|$)/.test(name)) score -= 100; if (language === "sw" && /(?:^|[_\-.])en(?:[_\-.]|$)/.test(name)) score -= 100; return score; }
function extractDetailSynopsis(markdown: string) { const detailHeading = /^##\s+(?:Version B|Toleo B)\b.*$/im.exec(markdown); if (!detailHeading || detailHeading.index === undefined) return ""; const afterHeading = markdown.slice(detailHeading.index + detailHeading[0].length); const nextHeading = /^##\s+/m.exec(afterHeading); return afterHeading.slice(0, nextHeading?.index).split("\n").map((line) => line.trim().replace(/^>\s?/, "")).filter((line) => line && line !== "---").join("\n\n").trim(); }

export function BilingualBookUploader() {
  const router = useRouter(); const inputRef = useRef<HTMLInputElement>(null);
  const [books, setBooks] = useState<PreparedBook[]>([]); const [message, setMessage] = useState("Choose a folder that contains book subfolders to begin."); const [busy, setBusy] = useState(false); const [publish, setPublish] = useState(true);
  useEffect(() => { inputRef.current?.setAttribute("webkitdirectory", ""); }, []);
  async function inspectFolders(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setBooks([]); setMessage("Reading book folders…");
    try {
      const allFiles = Array.from(files) as DirectoryFile[];
      const folders = new Map<string, DirectoryFile[]>();
      for (const file of allFiles) { const folder = (file.webkitRelativePath || file.name).split("/").slice(0, -1).join("/"); if (folder) folders.set(folder, [...(folders.get(folder) ?? []), file]); }
      const prepared: PreparedBook[] = [];
      const handledFolders = new Set<string>();
      const issues: string[] = [];

      // Standard packages retain their explicit metadata and take priority.
      for (const [folder, folderFiles] of folders) {
        const byName = new Map(folderFiles.map((file) => [file.name, file])); const metaFile = byName.get("story_meta.json"); if (!metaFile) continue; handledFolders.add(folder);
        try {
          const meta = JSON.parse(await metaFile.text()) as StoryMeta;
          const languageValue = String(meta.language ?? "").trim().toLowerCase();
          const declaredLanguage: Language | null = languageValue === "en" || languageValue === "english" ? "en" : languageValue === "sw" || languageValue === "swahili" || languageValue === "kiswahili" ? "sw" : null;
          const ranked = folderFiles.filter((file) => manuscriptScore(file.name) >= 0).sort((left, right) => manuscriptScore(right.name) - manuscriptScore(left.name));
          const manuscript = (declaredLanguage ? byName.get(declaredLanguage === "en" ? "故事正文_英文.md" : "故事正文_斯瓦希里语.md") : undefined) ?? byName.get("story.md") ?? ranked[0];
          const source = manuscript ? await manuscript.text() : "";
          const language = declaredLanguage ?? (manuscript ? inferLanguage(source, manuscript.name) : null);
          if (!language) throw new Error(`${folder} needs a valid language (en or sw).`);
          const synopsisFile = byName.get("book_synopsis.md"); const cover = byName.get("封面.jpg") ?? folderFiles.filter((file) => coverScore(file, language) >= 0).sort((left, right) => coverScore(right, language) - coverScore(left, language))[0]; const title = String(meta.title ?? (manuscript ? inferTitle(source, manuscript.name) : "")).trim(); const chapters = parseChapters(source, language, publish ? "published" : "draft"); const synopsis = synopsisFile ? extractDetailSynopsis(await synopsisFile.text()) : "";
          if (!title || !cover || !chapters.length) throw new Error(`${folder} needs title, cover, and numbered chapters.`);
          const originalSlug = slugify(String(meta.title_original ?? meta.title));
          prepared.push({ slug: slugify(title) + (language === "sw" ? "-sw" : ""), title, author: String(meta.author ?? "").trim() || "Soma Originals", language, category: SOMA_CATEGORIES.includes(String(meta.category ?? "")) ? String(meta.category) : "", tags: normalizedTags(meta.tags), description: synopsis || String(meta.description ?? "").trim(), status: publish ? "published" : "draft", coverDataUrl: await fileDataUrl(cover), chapters, group: originalSlug, originalSlug, explicitParent: String(meta.translation_of_slug ?? meta.translationOfSlug ?? "").trim() || undefined });
        } catch (error) { throw new Error(error instanceof Error ? error.message : `Could not read ${folder}.`); }
      }

      // Legacy completed projects may keep manuscripts and covers in nested folders without sidecar metadata.
      const legacyCandidates: Array<{ file: DirectoryFile; source: string; language: Language; score: number; path: string }> = [];
      for (const file of allFiles) {
        const path = file.webkitRelativePath || file.name; const folder = path.split("/").slice(0, -1).join("/");
        if ([...handledFolders].some((handled) => folder === handled || folder.startsWith(`${handled}/`)) || manuscriptScore(file.name) < 0) continue;
        const source = await file.text(); const language = inferLanguage(source, file.name); if (!language || !parseChapters(source, language, "draft").length) continue;
        legacyCandidates.push({ file, source, language, score: manuscriptScore(file.name), path });
      }
      if (legacyCandidates.length) {
        const selectedRoot = legacyCandidates[0].path.split("/")[0];
        const relativeParts = legacyCandidates.map((item) => item.path.split("/").slice(1));
        const structural = /^(?:\d+[_ -]|english|swahili|kiswahili|manuscripts?|covers?)/i;
        const hasDirectManuscript = relativeParts.some((parts) => parts.length === 1);
        const topChildren = new Set(relativeParts.filter((parts) => parts.length > 1).map((parts) => parts[0]));
        const archiveMode = !hasDirectManuscript && [...topChildren].some((name) => !structural.test(name));
        const projectGroups = new Map<string, typeof legacyCandidates>();
        for (const candidate of legacyCandidates) { const parts = candidate.path.split("/"); const project = archiveMode ? parts.slice(0, 2).join("/") : selectedRoot; projectGroups.set(project, [...(projectGroups.get(project) ?? []), candidate]); }
        for (const [project, candidates] of projectGroups) {
          const projectFiles = allFiles.filter((file) => { const path = file.webkitRelativePath || file.name; return path === project || path.startsWith(`${project}/`); });
          const group = slugify(project.split("/").at(-1)?.replace(/_v\d+(?:_\d+)*(?:-\d+)?(?:_project)?$/i, "") ?? project);
          for (const language of ["en", "sw"] as const) {
            const selected = candidates.filter((candidate) => candidate.language === language).sort((left, right) => right.score - left.score || left.path.localeCompare(right.path))[0]; if (!selected) continue;
            const cover = projectFiles.filter((file) => coverScore(file, language) >= 0).sort((left, right) => coverScore(right, language) - coverScore(left, language))[0];
            if (!cover) { issues.push(`${project}: no matching ${language.toUpperCase()} cover; skipped`); continue; }
            const chapters = parseChapters(selected.source, language, publish ? "published" : "draft"); const numbers = chapters.map((chapter) => chapter.number);
            if (new Set(numbers).size !== numbers.length || numbers.some((number, index) => number !== index + 1)) { issues.push(`${project}: ${language.toUpperCase()} chapter numbers are not continuous; skipped`); continue; }
            const title = inferTitle(selected.source, selected.file.name); const originalSlug = slugify(title);
            prepared.push({ slug: originalSlug + (language === "sw" ? "-sw" : ""), title, author: "Soma Originals", language, category: "", tags: [], description: "", status: publish ? "published" : "draft", coverDataUrl: await fileDataUrl(cover), chapters, group, originalSlug });
          }
        }
      }

      const grouped = new Map<string, PreparedBook[]>(); for (const book of prepared) grouped.set(book.group, [...(grouped.get(book.group) ?? []), book]);
      for (const group of grouped.values()) { const root = group.find((book) => book.language === "en") ?? group[0]; if (new Set(group.map((book) => book.language)).size !== group.length) throw new Error(`Duplicate language version found for “${root.title}”.`); for (const book of group) { if (book !== root) book.translationOfSlug = root.slug; else if (book.explicitParent) book.translationOfSlug = slugify(book.explicitParent); else if (book.language === "sw" && book.originalSlug !== book.slug.replace(/-sw$/, "")) book.translationOfSlug = book.originalSlug; } }
      const incompleteMetadata = prepared.filter(publicationMetadataMissing).map((book) => book.title);
      setBooks(prepared); const summary = `${prepared.length} book version(s) ready; ${[...grouped.values()].filter((group) => group.length > 1).length} bilingual pair(s) linked automatically.`; setMessage([summary, incompleteMetadata.length ? `${incompleteMetadata.length} version(s) need a description, category, or tags before publishing.` : "", ...issues].filter(Boolean).join(" "));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not inspect the selected folder."); } finally { setBusy(false); if (inputRef.current) inputRef.current.value = ""; }
  }
  async function upload() {
    if (!books.length || (publish && books.some(publicationMetadataMissing))) { setMessage("Every published book needs a public description, canonical category, and at least one tag."); return; } setBusy(true); setMessage("Uploading books and covers…");
    try { let importedBooks = 0; let importedChapters = 0; for (let start = 0; start < books.length; start += 20) { const response = await fetch("/api/admin/books/bulk", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ books: books.slice(start, start + 20).map((book) => ({ slug: book.slug, title: book.title, author: book.author, language: book.language, category: book.category, tags: book.tags, description: book.description.trim(), status: publish ? "published" : "draft", coverDataUrl: book.coverDataUrl, translationOfSlug: book.translationOfSlug, chapters: book.chapters.map((chapter) => ({ ...chapter, status: publish ? "published" : "draft" })) })) }) }); const result = await response.json() as { error?: string; importedBooks?: number; importedChapters?: number }; if (!response.ok) throw new Error(result.error ?? "The import failed."); importedBooks += result.importedBooks ?? 0; importedChapters += result.importedChapters ?? 0; } setMessage(`Imported ${importedBooks} book version(s) and ${importedChapters} chapter(s).`); router.refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "The import failed."); } finally { setBusy(false); }
  }
  return <section className="admin-form bilingual-import"><div className="admin-form-heading"><p className="eyebrow">Bilingual publishing</p><h1>Batch upload books</h1><p>Select standard packages or legacy completed-project folders. The importer accepts numeric or word-based Chapter/Sura headings from H1–H6, finds language-specific final manuscripts and covers, and links bilingual versions automatically.</p></div><label className="directory-picker">Book folders<input ref={inputRef} type="file" multiple className="sr-only" onChange={(event) => inspectFolders(event.target.files)} /><button type="button" className="button button-secondary" disabled={busy} onClick={() => inputRef.current?.click()}>{busy ? "Working…" : "Choose book folder"}</button></label><label className="publish-toggle"><input type="checkbox" checked={publish} onChange={(event) => setPublish(event.target.checked)} /> Publish immediately (otherwise import as drafts)</label>{books.length > 0 && <div className="prepared-books">{books.map((book) => <div key={book.slug}><strong>{book.title}</strong><span>{book.language === "en" ? "English" : "Kiswahili"} · {book.chapters.length} chapters{book.translationOfSlug ? " · linked translation" : " · original / standalone"}</span><select aria-label={`${book.title} category`} value={book.category} onChange={(event) => setBooks((current) => current.map((item) => item.slug === book.slug ? { ...item, category: event.target.value } : item))}><option value="">Choose category</option>{SOMA_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select><input aria-label={`${book.title} tags`} defaultValue={book.tags.join(", ")} placeholder="Tags, separated by commas" onChange={(event) => setBooks((current) => current.map((item) => item.slug === book.slug ? { ...item, tags: normalizedTags(event.target.value.split(",")) } : item))} /><textarea aria-label={`${book.title} description`} value={book.description} placeholder="Add a public book description" onChange={(event) => setBooks((current) => current.map((item) => item.slug === book.slug ? { ...item, description: event.target.value } : item))} /></div>)}</div>}<div className="form-actions"><button type="button" className="button button-primary" disabled={busy || !books.length || (publish && books.some(publicationMetadataMissing))} onClick={upload}>Upload {books.length || ""} book version(s) →</button></div><p className="form-note" role="status">{message}</p></section>;
}
