"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/app/components/language-provider";

export function PublishBookButton({ id, status }: { id: string; status: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  if (status === "published") return <span className="status-published">{t("published")}</span>;
  return <div><button className="button button-primary" type="button" disabled={saving} onClick={async () => { setSaving(true); setMessage(""); const response = await fetch(`/api/admin/books/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "published" }) }); const result = await response.json().catch(() => ({})); setSaving(false); if (!response.ok) { setMessage(result.error ?? "Could not publish the book."); return; } router.refresh(); }}>{saving ? "Publishing…" : t("publish")} <span>→</span></button>{message && <p className="form-note" role="alert">{message}</p>}</div>;
}
