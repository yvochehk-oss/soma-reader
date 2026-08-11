"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/app/components/language-provider";
import { cacheReaderUrls, saveDownloadedChapter, trackEvent, type DownloadedChapter } from "@/app/lib/reader-client";

type ChapterToDownload = { id?: string; number: number; title: string; content: string };
type ReaderPreferences = { fontSize: number; lineHeight: number; theme: "light" | "sepia" | "dark" };

const DEFAULT_PREFERENCES: ReaderPreferences = { fontSize: 20, lineHeight: 1.95, theme: "sepia" };

function readStoredJson(key: string): unknown {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    try { localStorage.removeItem(key); } catch { /* Storage can be unavailable. */ }
    return null;
  }
}

function writeStoredJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Reading must keep working without storage. */ }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown, fallback: number, min: number, max: number) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function toDownloaded(bookSlug: string, chapter: ChapterToDownload): DownloadedChapter {
  return { key: `${bookSlug}:${chapter.number}`, bookSlug, chapterNumber: chapter.number, title: chapter.title, content: chapter.content, downloadedAt: new Date().toISOString() };
}

export function ReaderShell({ children, bookSlug, chapterNumber, bookId, chapterId, chapters }: {
  children: React.ReactNode;
  bookSlug: string;
  chapterNumber: number;
  bookId?: string;
  chapterId?: string;
  chapters: ChapterToDownload[];
}) {
  const { t } = useTranslation();
  const [preferences, setPreferences] = useState<ReaderPreferences>(DEFAULT_PREFERENCES);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [controlNote, setControlNote] = useState("");
  const [scrollPercent, setScrollPercent] = useState(0);
  const reached = useRef(new Set<string>());
  const startedAt = useRef(0);
  const progressTimer = useRef<number | undefined>(undefined);
  const scrollFrame = useRef<number | undefined>(undefined);
  const progressWriteTimer = useRef<number | undefined>(undefined);
  const latestScrollPercent = useRef(0);
  const lastStoredPercent = useRef<number | undefined>(undefined);
  const activeChapter = chapters.find((item) => item.number === chapterNumber);

  useEffect(() => {
    const storedPreference = readStoredJson("soma-reader-settings");
    const preference = isRecord(storedPreference) ? storedPreference : {};
    const storedTheme = preference.theme === "light" || preference.theme === "sepia" || preference.theme === "dark" ? preference.theme : DEFAULT_PREFERENCES.theme;
    setPreferences({
      fontSize: finiteNumber(preference.fontSize, DEFAULT_PREFERENCES.fontSize, 17, 25),
      lineHeight: finiteNumber(preference.lineHeight, DEFAULT_PREFERENCES.lineHeight, 1.5, 2.2),
      theme: storedTheme,
    });
    setPreferencesLoaded(true);

    const storedProgress = readStoredJson(`soma-progress:${bookSlug}`);
    const progress = isRecord(storedProgress) ? storedProgress : null;
    const storedChapter = progress ? finiteNumber(progress.chapterNumber, 0, 0, Number.MAX_SAFE_INTEGER) : 0;
    const storedPercent = progress ? finiteNumber(progress.scrollPercent, 0, 0, 100) : 0;
    latestScrollPercent.current = storedChapter === chapterNumber ? storedPercent : 0;
    lastStoredPercent.current = storedChapter === chapterNumber ? storedPercent : undefined;
    const restoreTimer = storedChapter === chapterNumber && storedPercent > 0
      ? window.setTimeout(() => window.scrollTo({ top: Math.max(0, document.documentElement.scrollHeight - window.innerHeight) * storedPercent / 100, behavior: "auto" }), 150)
      : undefined;
    void trackEvent({ eventType: "chapter_start", bookId, chapterId });
    startedAt.current = Date.now();
    return () => { if (restoreTimer) window.clearTimeout(restoreTimer); };
  }, [bookSlug, chapterNumber, bookId, chapterId]);

  useEffect(() => {
    if (preferencesLoaded) writeStoredJson("soma-reader-settings", preferences);
  }, [preferences, preferencesLoaded]);

  useEffect(() => {
    if (!activeChapter) return;
    void saveDownloadedChapter(toDownloaded(bookSlug, activeChapter));
    const next = chapters.find((item) => item.number === chapterNumber + 1);
    if (next) {
      void saveDownloadedChapter(toDownloaded(bookSlug, next));
      cacheReaderUrls([`/read/${bookSlug}/${next.number}`]);
    }
  }, [activeChapter, bookSlug, chapterNumber, chapters]);

  useEffect(() => {
    const syncFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    syncFullscreen();
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  useEffect(() => {
    const progressKey = `soma-progress:${bookSlug}`;

    function persistProgress() {
      progressWriteTimer.current = undefined;
      const percent = latestScrollPercent.current;
      if (lastStoredPercent.current === percent) return;
      writeStoredJson(progressKey, { chapterNumber, scrollPercent: percent, updatedAt: new Date().toISOString() });
      lastStoredPercent.current = percent;
    }

    function scheduleProgressWrite() {
      if (!progressWriteTimer.current) progressWriteTimer.current = window.setTimeout(persistProgress, 1000);
    }

    function updateProgress() {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const percent = Math.min(100, Math.max(0, Math.round(window.scrollY / max * 100)));
      latestScrollPercent.current = percent;
      setScrollPercent((current) => current === percent ? current : percent);
      scheduleProgressWrite();
      const checkpoints: Array<[number, "chapter_25" | "chapter_50" | "chapter_75" | "chapter_complete"]> = [[25, "chapter_25"], [50, "chapter_50"], [75, "chapter_75"], [98, "chapter_complete"]];
      checkpoints.forEach(([limit, eventType]) => {
        if (percent >= limit && !reached.current.has(eventType)) {
          reached.current.add(eventType);
          void trackEvent({ eventType, bookId, chapterId, readingSeconds: Math.max(1, Math.round((Date.now() - startedAt.current) / 1000)) });
        }
      });
      if (bookId && navigator.onLine && !progressTimer.current) {
        progressTimer.current = window.setTimeout(() => {
          progressTimer.current = undefined;
          void fetch("/api/progress", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bookId, chapterId, chapterNumber, scrollPercent: latestScrollPercent.current }), keepalive: true });
        }, 12000);
      }
    }

    function handleScroll() {
      if (scrollFrame.current) return;
      scrollFrame.current = window.requestAnimationFrame(() => {
        scrollFrame.current = undefined;
        updateProgress();
      });
    }

    function flushProgress() {
      if (scrollFrame.current) {
        window.cancelAnimationFrame(scrollFrame.current);
        scrollFrame.current = undefined;
        updateProgress();
      }
      if (progressWriteTimer.current) window.clearTimeout(progressWriteTimer.current);
      persistProgress();
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("pagehide", flushProgress);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("pagehide", flushProgress);
      if (scrollFrame.current) window.cancelAnimationFrame(scrollFrame.current);
      if (progressWriteTimer.current) window.clearTimeout(progressWriteTimer.current);
      if (progressTimer.current) window.clearTimeout(progressTimer.current);
      persistProgress();
    };
  }, [bookSlug, chapterNumber, bookId, chapterId]);

  function changeFontSize(delta: number) { setPreferences((current) => ({ ...current, fontSize: Math.min(25, Math.max(17, current.fontSize + delta)) })); }
  async function download(count: number) {
    setDownloading(true);
    const selected = chapters.filter((item) => item.number >= chapterNumber).slice(0, count);
    try {
      await Promise.all(selected.map((chapter) => saveDownloadedChapter(toDownloaded(bookSlug, chapter))));
      cacheReaderUrls(selected.map((chapter) => `/read/${bookSlug}/${chapter.number}`));
      void trackEvent({ eventType: "offline_download", bookId, chapterId });
      setControlNote(t("downloaded"));
    } finally { setDownloading(false); }
  }
  async function toggleFullscreen() { if (document.fullscreenElement) await document.exitFullscreen(); else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); else setControlNote(t("fullscreenUnavailable")); }
  function turnPage(direction: "previous" | "next") {
    const amount = Math.round(window.innerHeight * 0.82);
    window.scrollBy({ top: direction === "next" ? amount : -amount, behavior: "smooth" });
  }
  function seekTo(percent: number) {
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo({ top: maxScroll * percent / 100, behavior: "smooth" });
  }
  function handleReaderTap(event: React.MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("a,button,select,input,label,textarea,.adsbygoogle,.reader-ad")) return;
    const width = window.innerWidth;
    if (event.clientX <= width * 0.3) turnPage("previous");
    else if (event.clientX >= width * 0.7) turnPage("next");
    else setMenuOpen((open) => !open);
  }

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if ((event.target as HTMLElement | null)?.closest("input, textarea, select, button")) return;
      if (event.key === "ArrowLeft") { event.preventDefault(); turnPage("previous"); }
      if (event.key === "ArrowRight" || event.key === " ") { event.preventDefault(); turnPage("next"); }
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  });

  return <div className={`reader-page reader-theme-${preferences.theme}${menuOpen ? " reader-menu-open" : ""}`} style={{ "--reader-size": `${preferences.fontSize}px`, "--reader-line-height": preferences.lineHeight } as React.CSSProperties} onClick={handleReaderTap}>
    {children}
    <div className={`reader-controls ${menuOpen ? "reader-controls-open" : ""}`} aria-label={t("readingSettings")}>
      <div className="reader-control-group"><span>{t("readingSettings")}</span><button type="button" onClick={() => changeFontSize(-1)} aria-label={t("decreaseText")}>A−</button><button type="button" onClick={() => changeFontSize(1)} aria-label={t("increaseText")}>A+</button></div>
      <div className="reader-control-group"><span>{t("lineSpacing")}</span><button type="button" onClick={() => setPreferences((current) => ({ ...current, lineHeight: current.lineHeight > 1.9 ? 1.65 : current.lineHeight > 1.7 ? 1.8 : 1.95 }))}>{preferences.lineHeight.toFixed(2)}</button></div>
      <div className="reader-control-group"><span>{t("theme")}</span>{(["light", "sepia", "dark"] as const).map((value) => <button key={value} type="button" className={preferences.theme === value ? "active" : ""} onClick={() => setPreferences((current) => ({ ...current, theme: value }))}>{t(value)}</button>)}</div>
      <div className="reader-control-group"><button type="button" onClick={toggleFullscreen}>{fullscreen ? t("exitFullscreen") : t("fullscreen")}</button><button type="button" disabled={downloading} onClick={() => download(1)}>{downloading ? t("downloading") : t("download")}</button><button type="button" disabled={downloading} onClick={() => download(10)}>{t("downloadNext10")}</button><button type="button" disabled={downloading} onClick={() => download(20)}>{t("downloadNext20")}</button></div>
      {controlNote && <p className="reader-control-note" role="status">{controlNote}</p>}
    </div>
    <div className="reader-mobile-toolbar" aria-label={t("readingSettings")}>
      <button type="button" onClick={() => turnPage("previous")} disabled={scrollPercent === 0} aria-label="Previous page">‹</button>
      <label className="reader-progress"><span>{String(chapterNumber).padStart(2, "0")} · {scrollPercent}%</span><input type="range" min="0" max="100" value={scrollPercent} onChange={(event) => seekTo(Number(event.target.value))} aria-label="Reading progress" /></label>
      <button type="button" onClick={() => turnPage("next")} disabled={scrollPercent >= 100} aria-label="Next page">›</button>
      <button type="button" onClick={() => setMenuOpen((open) => !open)} aria-label={t("readingSettings")}>Aa</button>
    </div>
    <button className="reader-settings" type="button" onClick={() => setMenuOpen((open) => !open)} aria-label={t("readingSettings")}>Aa</button>
  </div>;
}
