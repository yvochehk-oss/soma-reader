"use client";

import { useEffect, useMemo, useState } from "react";
import { getLocalBookById, type StoredLocalBook } from "@/app/lib/local-library-store";

type ReaderTheme = "light" | "sepia" | "dark";
type ReaderPreferences = { fontSize: number; lineHeight: number; theme: ReaderTheme };
type LocalRoute = { id: string; chapterText: string };
type LoadState =
  | { status: "loading" }
  | { status: "ready"; book: StoredLocalBook }
  | { status: "invalid-link" }
  | { status: "missing" }
  | { status: "error" };

const DEFAULT_PREFERENCES: ReaderPreferences = { fontSize: 20, lineHeight: 1.95, theme: "sepia" };

function ReaderMessage({ title, message }: { title: string; message: string }) {
  return (
    <div className="reader-page reader-theme-sepia">
      <main className="reader-main">
        <span className="reader-chapter-label">Local reading</span>
        <h1>{title}</h1>
        <p>{message}</p>
        <a className="button button-primary" href="/offline">Back to Offline Library <span>→</span></a>
      </main>
    </div>
  );
}

export default function LocalReadPage() {
  const [route, setRoute] = useState<LocalRoute | null>(null);
  const id = route?.id ?? "";
  const chapterNumber = route && /^\d+$/.test(route.chapterText) ? Number(route.chapterText) : Number.NaN;
  const validChapterNumber = Number.isSafeInteger(chapterNumber) && chapterNumber > 0;
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [preferences, setPreferences] = useState<ReaderPreferences>(DEFAULT_PREFERENCES);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Keep this route statically renderable: user-controlled local book IDs and chapter numbers
  // are read only in the browser, never from Next's request-time searchParams API.
  useEffect(() => {
    const url = new URL(window.location.href);
    setRoute({ id: url.searchParams.get("id") ?? "", chapterText: url.searchParams.get("chapter") ?? "1" });
  }, []);

  useEffect(() => {
    if (!route) return;
    let cancelled = false;
    if (!id) {
      setLoadState({ status: "invalid-link" });
      return;
    }
    setLoadState({ status: "loading" });
    void getLocalBookById(id).then((book) => {
      if (!cancelled) setLoadState(book ? { status: "ready", book } : { status: "missing" });
    }).catch(() => {
      if (!cancelled) setLoadState({ status: "error" });
    });
    return () => { cancelled = true; };
  }, [id, route]);

  useEffect(() => {
    if (!id) return;
    setPreferencesLoaded(false);
    try {
      const saved = localStorage.getItem(`soma-local-reader-settings:${id}`);
      if (saved) {
        const value = JSON.parse(saved) as Partial<ReaderPreferences>;
        const theme = value.theme === "light" || value.theme === "sepia" || value.theme === "dark" ? value.theme : DEFAULT_PREFERENCES.theme;
        const fontSize = Number(value.fontSize);
        const lineHeight = Number(value.lineHeight);
        setPreferences({
          theme,
          fontSize: Number.isFinite(fontSize) ? Math.min(25, Math.max(17, fontSize)) : DEFAULT_PREFERENCES.fontSize,
          lineHeight: Number.isFinite(lineHeight) ? Math.min(2.2, Math.max(1.5, lineHeight)) : DEFAULT_PREFERENCES.lineHeight,
        });
      } else {
        setPreferences(DEFAULT_PREFERENCES);
      }
    } catch {
      setPreferences(DEFAULT_PREFERENCES);
    }
    setPreferencesLoaded(true);
  }, [id]);

  useEffect(() => {
    if (!id || !preferencesLoaded) return;
    try { localStorage.setItem(`soma-local-reader-settings:${id}`, JSON.stringify(preferences)); } catch { /* Local reading must work when storage is unavailable. */ }
  }, [id, preferences, preferencesLoaded]);

  const chapters = useMemo(() => {
    if (loadState.status !== "ready" || !Array.isArray(loadState.book.chapters)) return [];
    return loadState.book.chapters
      .filter((chapter) => Number.isSafeInteger(chapter.number) && chapter.number > 0 && typeof chapter.content === "string")
      .slice()
      .sort((left, right) => left.number - right.number);
  }, [loadState]);
  const chapterIndex = chapters.findIndex((chapter) => chapter.number === chapterNumber);
  const chapter = chapterIndex >= 0 ? chapters[chapterIndex] : undefined;
  const previous = chapterIndex > 0 ? chapters[chapterIndex - 1] : undefined;
  const next = chapterIndex >= 0 ? chapters[chapterIndex + 1] : undefined;
  const paragraphs = chapter?.content.split(/\r?\n\s*\r?\n/).map((text) => text.trim()).filter(Boolean) ?? [];

  function movePage(direction: "previous" | "next") {
    window.scrollBy({ top: (direction === "next" ? 1 : -1) * Math.round(window.innerHeight * 0.82), behavior: "smooth" });
  }

  function handleReaderTap(event: React.MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("a,button,input,label,textarea,select")) return;
    const width = window.innerWidth;
    if (event.clientX <= width * 0.3) movePage("previous");
    else if (event.clientX >= width * 0.7) movePage("next");
    else setMenuOpen((open) => !open);
  }

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if ((event.target as HTMLElement | null)?.closest("a,button,input,textarea,select")) return;
      if (event.key === "ArrowLeft") { event.preventDefault(); movePage("previous"); }
      if (event.key === "ArrowRight" || event.key === " ") { event.preventDefault(); movePage("next"); }
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  });

  if (!route) return <ReaderMessage title="Opening your book…" message="Loading the copy saved on this device." />;
  if (loadState.status === "invalid-link") return <ReaderMessage title="Invalid local book link" message="This address is missing the local book ID. Reopen the book from the Offline Library." />;
  if (loadState.status === "loading") return <ReaderMessage title="Opening your book…" message="Loading the copy saved on this device." />;
  if (loadState.status === "error") return <ReaderMessage title="Could not open this book" message="This browser could not access its local book library. Try opening it again from the Offline Library on the device where it was imported." />;
  if (loadState.status === "missing") return <ReaderMessage title="Local book not found" message="This book is no longer stored on this device. It may have been removed, or imported on a different browser or device." />;
  if (!validChapterNumber) return <ReaderMessage title="Chapter not found" message="The chapter number in this link is not valid." />;
  if (!chapters.length) return <ReaderMessage title="No readable chapters" message="This book is saved on this device, but it does not contain any readable chapters." />;
  if (!chapter) return <ReaderMessage title="Chapter not found" message={`Chapter ${route.chapterText} is not part of “${loadState.book.title}”.`} />;

  const localChapterHref = (number: number) => `/local-read?id=${encodeURIComponent(id)}&chapter=${number}`;

  return (
    <div
      className={`reader-page reader-theme-${preferences.theme}${menuOpen ? " reader-menu-open" : ""}`}
      style={{ "--reader-size": `${preferences.fontSize}px`, "--reader-line-height": preferences.lineHeight } as React.CSSProperties}
      onClick={handleReaderTap}
    >
      <div className="reader-top">
        <a href="/offline">← Offline library</a>
        <span className="reader-title">{loadState.book.title}</span>
        <span />
      </div>
      <main className="reader-main">
        <div className="offline-note">✓ Stored on this device · {loadState.book.format.toUpperCase()}</div>
        <span className="reader-chapter-label">Chapter {String(chapter.number).padStart(2, "0")} · {chapterIndex + 1} of {chapters.length}</span>
        <h1>{chapter.title}</h1>
        <article className="reader-body">
          {paragraphs.length ? paragraphs.map((paragraph, index) => <p key={index}>{paragraph.replace(/\r?\n/g, " ")}</p>) : <p>This chapter is empty.</p>}
        </article>
        <div className="reader-footer">
          {previous ? <a href={localChapterHref(previous.number)}>← Previous chapter</a> : <span />}
          {next ? <a href={localChapterHref(next.number)}>Next chapter →</a> : <a href="/offline">Back to library →</a>}
        </div>
      </main>
      <div className={`reader-controls ${menuOpen ? "reader-controls-open" : ""}`} aria-label="Reading settings">
        <div className="reader-control-group">
          <span>Text size</span>
          <button type="button" onClick={() => setPreferences((current) => ({ ...current, fontSize: Math.max(17, current.fontSize - 1) }))} aria-label="Decrease text size">A−</button>
          <button type="button" onClick={() => setPreferences((current) => ({ ...current, fontSize: Math.min(25, current.fontSize + 1) }))} aria-label="Increase text size">A+</button>
        </div>
        <div className="reader-control-group">
          <span>Line spacing</span>
          <button type="button" onClick={() => setPreferences((current) => ({ ...current, lineHeight: current.lineHeight > 1.9 ? 1.65 : current.lineHeight > 1.7 ? 1.8 : 1.95 }))}>{preferences.lineHeight.toFixed(2)}</button>
        </div>
        <div className="reader-control-group">
          <span>Theme</span>
          {(["light", "sepia", "dark"] as const).map((theme) => <button key={theme} type="button" className={preferences.theme === theme ? "active" : ""} onClick={() => setPreferences((current) => ({ ...current, theme }))}>{theme}</button>)}
        </div>
      </div>
      <div className="reader-mobile-toolbar" aria-label="Reading controls">
        <button type="button" onClick={() => movePage("previous")} aria-label="Previous page">‹</button>
        <span className="reader-progress">{String(chapter.number).padStart(2, "0")} · {chapterIndex + 1}/{chapters.length}</span>
        <button type="button" onClick={() => movePage("next")} aria-label="Next page">›</button>
        <button type="button" onClick={() => setMenuOpen((open) => !open)} aria-label="Reading settings">Aa</button>
      </div>
      <button className="reader-settings" type="button" onClick={() => setMenuOpen((open) => !open)} aria-label="Reading settings">Aa</button>
    </div>
  );
}
