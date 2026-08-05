"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/app/components/language-provider";

export function ClearBookLibraryButton({ count }: { count: number }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [clearing, setClearing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  async function clearLibrary() {
    if (confirmation !== `DELETE ${count}`) return;
    setClearing(true); setMessage("");
    try {
      const response = await fetch("/api/admin/books", { method: "DELETE" });
      const body = await response.json() as { error?: string; deletedBooks?: number };
      if (!response.ok) throw new Error(body.error ?? "Could not clear books.");
      setMessage(t("booksCleared", { count: body.deletedBooks ?? 0 }));
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not clear books."); } finally { setClearing(false); }
  }
  return <div className="clear-library-action">{confirming ? <div><label>{t("clearBooksConfirm", { count })}<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={`DELETE ${count}`} autoComplete="off" /></label><div className="button-row"><button type="button" className="button button-danger" disabled={clearing || confirmation !== `DELETE ${count}`} onClick={clearLibrary}>{clearing ? t("clearingBooks") : t("clearAllBooks")}</button><button type="button" className="button button-secondary" onClick={() => { setConfirming(false); setConfirmation(""); }}>Cancel</button></div></div> : <button type="button" className="button button-danger" disabled={!count} onClick={() => setConfirming(true)}>{t("clearAllBooks")}</button>}{message && <p className="form-note" role="status">{message}</p>}</div>;
}
