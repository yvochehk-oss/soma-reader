"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/supabase/browser";
import { useTranslation } from "@/app/components/language-provider";
import { supabaseIsConfigured } from "@/app/lib/reader-client";

type ExistingBook = { id: string; slug: string; title: string; author_name: string; language_code: "en" | "sw"; category: string; description: string; cover_url?: string | null; status: "draft" | "published" | "hidden" };

export function AdminBookForm({ existing }: { existing?: ExistingBook }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseIsConfigured()) { setMessage("Connect Supabase before saving content."); return; }
    const form = new FormData(event.currentTarget);
    const values = { title: form.get("title"), authorName: form.get("authorName"), language: form.get("language"), category: form.get("category"), description: form.get("description") };
    setSaving(true); setMessage("");
    const response = await fetch(existing ? `/api/admin/books/${existing.id}` : "/api/admin/books", { method: existing ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(existing ? { title: values.title, author_name: values.authorName, language_code: values.language, category: values.category, description: values.description } : values) });
    const result = await response.json();
    if (!response.ok) { setSaving(false); setMessage(result.error ?? "Could not save the book."); return; }
    const book = result.book as { id: string; slug: string };
    const file = fileRef.current?.files?.[0];
    if (file) {
      const supabase = createClient();
      const path = `${book.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
      const upload = await supabase.storage.from("covers").upload(path, file, { upsert: false, contentType: file.type });
      if (upload.error) { setSaving(false); setMessage(upload.error.message); return; }
      const { data } = supabase.storage.from("covers").getPublicUrl(path);
      await fetch(`/api/admin/books/${book.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ cover_url: data.publicUrl }) });
    }
    setSaving(false); router.push(`/admin/books/${book.id}`); router.refresh();
  }
  return <form className="admin-form" onSubmit={submit}><div className="form-grid"><label>{t("bookTitle")}<input name="title" required defaultValue={existing?.title ?? ""} placeholder="e.g. Love in Nairobi" /></label><label>{t("authorName")}<input name="authorName" required defaultValue={existing?.author_name ?? ""} placeholder="e.g. Amina K." /></label><label>{t("language")}<select name="language" defaultValue={existing?.language_code ?? "en"}><option value="en">{t("english")}</option><option value="sw">{t("kiswahili")}</option></select></label><label>{t("category")}<input name="category" defaultValue={existing?.category ?? ""} placeholder="Romance, thriller, life..." /></label></div><label>{t("description")}<textarea name="description" rows={5} defaultValue={existing?.description ?? ""} placeholder="A short description readers can see on the book page." /></label><label>{t("coverImage")}<input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" /></label><div className="form-actions"><button disabled={saving} type="submit" className="button button-primary">{saving ? "Saving…" : existing ? t("saveChanges") : t("saveDraft")} <span>→</span></button></div>{message && <p className="form-note" role="status">{message}</p>}</form>;
}
