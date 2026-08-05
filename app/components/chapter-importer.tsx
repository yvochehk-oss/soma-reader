"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/app/components/language-provider";

type Chapter = { number: number; title: string; content: string };

function parseChapters(text: string): Chapter[] {
  const json = text.trim();
  if (json.startsWith("{")) {
    const payload = JSON.parse(json) as { chapters?: Array<{ number?: number; title?: string; content?: string }> };
    return (payload.chapters ?? []).map((chapter, index) => ({ number: Number(chapter.number ?? index + 1), title: String(chapter.title ?? `Chapter ${index + 1}`), content: String(chapter.content ?? "") }));
  }
  const pieces = text.split(/(?=^(?:#{1,6}\s*)?(?:chapter\s*)?\d+\s*[-:.)]\s*.+$)/im).map((part) => part.trim()).filter(Boolean);
  return pieces.map((piece, index) => {
    const [heading, ...body] = piece.split("\n");
    const match = heading.match(/^(?:#{1,6}\s*)?(?:chapter\s*)?(\d+)\s*[-:.)]\s*(.+)$/i);
    return { number: Number(match?.[1] ?? index + 1), title: match?.[2]?.trim() || `Chapter ${index + 1}`, content: body.join("\n").trim() };
  });
}

export function ChapterImporter({ bookId }: { bookId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [importing, setImporting] = useState(false);
  async function importFile() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    try {
      const chapters = parseChapters(await file.text());
      if (!chapters.length) { setMessage("No chapters found. Use the standard JSON format or headings such as ‘Chapter 1: Title’. "); return; }
      setImporting(true); setMessage("");
      const response = await fetch("/api/admin/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bookId, chapters }) });
      const body = await response.json();
      if (!response.ok) { setMessage(body.error ?? "Import failed."); return; }
      setMessage(`${chapters.length} chapters imported.`); router.refresh();
    } catch { setMessage("Could not read this file. Check that it is valid JSON, TXT or Markdown."); }
    finally { setImporting(false); }
  }
  return <div className="import-box"><div><h3>{t("batchImport")}</h3><p>{t("batchImportText")}</p></div><div><input ref={fileRef} className="sr-only" type="file" accept=".json,.txt,.md,text/plain,application/json,text/markdown" onChange={importFile} /><button type="button" className="button button-secondary" disabled={importing} onClick={() => fileRef.current?.click()}>{importing ? "Importing…" : t("chooseFile")}</button>{message && <p className="form-note">{message}</p>}</div></div>;
}
