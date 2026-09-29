"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Book } from "@/app/lib/demo-data";
import { BookCard } from "@/app/components/book-card";
import { useTranslation } from "@/app/components/language-provider";
import { createClient } from "@/app/lib/supabase/browser";
import { supabaseIsConfigured } from "@/app/lib/reader-client";

type Progress = { book_id: string; chapter_number: number; scroll_percent: number; updated_at: string };

export function LibraryShelf({ books }: { books: Book[] }) {
  const { t } = useTranslation();
  const [shelfIds, setShelfIds] = useState<string[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [loaded, setLoaded] = useState(() => !supabaseIsConfigured());
  useEffect(() => {
    if (!supabaseIsConfigured()) return;
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const [{ data: shelf }, { data: reading }] = await Promise.all([
        supabase.from("bookshelf").select("book_id").eq("user_id", user.id),
        supabase.from("reading_progress").select("book_id,chapter_number,scroll_percent,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }),
      ]);
      setShelfIds((shelf ?? []).map((row) => row.book_id));
      setProgress((reading ?? []) as Progress[]);
    }).finally(() => setLoaded(true));
  }, []);
  const byId = useMemo(() => new Map(books.filter((book) => book.id).map((book) => [book.id!, book])), [books]);
  const saved = shelfIds.map((id) => byId.get(id)).filter((book): book is Book => Boolean(book));
  const continued = progress.map((item) => ({ ...item, book: byId.get(item.book_id) })).find((item) => item.book);
  if (!loaded) return <div className="empty-state"><p>Loading…</p></div>;
  if (!saved.length && !continued) return <div className="empty-state"><h2>{t("emptyShelf")}</h2><p>{t("emptyShelfText")}</p><Link href="/discover" className="button button-primary">{t("exploreStories")} <span>→</span></Link></div>;
  return <>
    {continued?.book && <section className="continue-card"><div><p className="eyebrow">{t("continueReading")}</p><h2>{continued.book.title}</h2><p className="book-card-meta">{t("chapter", { number: String(continued.chapter_number).padStart(2, "0") })} · {continued.scroll_percent}%</p></div><a href={`/read/${continued.book.slug}/${continued.chapter_number}`} className="button button-primary">{t("continue")} <span>→</span></a></section>}
    {saved.length > 0 && <><div className="section-heading library-heading"><div><p className="eyebrow">{t("savedLater")}</p><h2>{t("shelfGrowing")}</h2></div></div><div className="book-grid">{saved.map((book) => <BookCard key={book.slug} book={book} />)}</div></>}
  </>;
}
