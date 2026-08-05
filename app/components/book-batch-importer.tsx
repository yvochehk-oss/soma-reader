"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/app/components/language-provider";

export function BookBatchImporter() {
  const { t } = useTranslation();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [importing, setImporting] = useState(false);

  async function importFile() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      setImporting(true);
      setMessage("");
      const response = await fetch("/api/admin/books/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json() as { error?: string; importedBooks?: number; importedChapters?: number };
      if (!response.ok) {
        setMessage(body.error ?? t("batchBooksImportFailed"));
        return;
      }
      setMessage(t("batchBooksImported", { books: body.importedBooks ?? 0, chapters: body.importedChapters ?? 0 }));
      router.refresh();
    } catch {
      setMessage(t("batchBooksInvalidFile"));
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return <section className="import-box"><div><h3>{t("batchBooksImport")}</h3><p>{t("batchBooksImportText")}</p><code className="form-note">{`{ "books": [{ "title": "…", "author": "…", "language": "en", "coverDataUrl": "data:image/jpeg;base64,…", "chapters": […] }] }`}</code></div><div><input ref={fileRef} className="sr-only" type="file" accept="application/json,.json" onChange={importFile} /><button type="button" className="button button-secondary" disabled={importing} onClick={() => fileRef.current?.click()}>{importing ? t("importing") : t("chooseJsonFile")}</button>{message && <p className="form-note">{message}</p>}</div></section>;
}
