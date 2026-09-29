"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslation } from "@/app/components/language-provider";
import { deleteOfflineBook, listDownloadedChapters, type DownloadedChapter } from "@/app/lib/reader-client";
import { listLocalBooks, deleteLocalBook, type StoredLocalBook } from "@/app/lib/local-library-store";
import { ImportLocalBookModal } from "@/app/components/import-local-book-modal";

export function OfflineLibrary() {
  const { t } = useTranslation();
  const [downloadedChapters, setDownloadedChapters] = useState<DownloadedChapter[]>([]);
  const [localBooks, setLocalBooks] = useState<StoredLocalBook[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const refresh = async () => {
    try {
      const [chs, lBooks] = await Promise.all([listDownloadedChapters(), listLocalBooks()]);
      setDownloadedChapters(chs);
      setLocalBooks(lBooks);
    } catch {
      setDownloadedChapters([]);
      setLocalBooks([]);
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const offlineGroups = Object.values(
    downloadedChapters.reduce<Record<string, DownloadedChapter[]>>((all, chapter) => {
      (all[chapter.bookSlug] ??= []).push(chapter);
      return all;
    }, {})
  );

  if (!loaded) return <div className="empty-state"><p>Loading offline library…</p></div>;

  return (
    <div className="offline-library-container flex flex-col gap-8">
      {/* Import Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-line shadow-sm">
        <div>
          <h3 className="font-bold text-lg text-ink m-0 flex items-center gap-2">
            <span>📱</span> My Local Library &amp; Protected Downloads
          </h3>
          <p className="text-xs text-muted mt-1 m-0">
            Encrypted offline packages &amp; zero-server local TXT/EPUB books.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setImportModalOpen(true)}
          className="button button-primary text-xs py-2.5 px-5 flex items-center gap-2 shrink-0"
        >
          <span>📂</span> Import Local TXT/EPUB
        </button>
      </div>

      {/* Modal Importer */}
      <ImportLocalBookModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImportSuccess={() => {
          void refresh();
        }}
      />

      {/* Section 1: Pure Local Imported Books (TXT / EPUB) */}
      <div className="local-imported-section">
        <h4 className="font-bold text-base text-ink mb-3 flex items-center gap-2">
          <span>📚</span> Local Imported Files (Zero Upload)
        </h4>

        {localBooks.length === 0 ? (
          <div className="p-6 border border-dashed border-line rounded-xl text-center bg-paper/50">
            <p className="text-xs text-muted m-0">No local TXT or EPUB books imported yet.</p>
            <button
              onClick={() => setImportModalOpen(true)}
              className="text-xs font-bold text-orange-dark mt-2 border-0 bg-transparent cursor-pointer underline"
            >
              Click here to import a TXT/EPUB file from your device
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {localBooks.map((b) => (
              <div key={b.id} className="p-4 rounded-xl border border-line bg-white shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="pill pill-orange uppercase text-[10px]">{b.format}</span>
                    <button
                      onClick={async () => {
                        await deleteLocalBook(b.id);
                        void refresh();
                      }}
                      className="text-xs text-muted hover:text-red-500 border-0 bg-transparent cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                  <h5 className="font-bold text-base text-ink m-0 line-clamp-1">{b.title}</h5>
                  <p className="text-xs text-muted mt-1 m-0">{b.chaptersCount} chapters • Stored locally</p>
                </div>
                <div className="mt-4 pt-3 border-t border-line flex justify-between items-center">
                  <span className="text-[11px] text-muted">🔒 Encrypted on Device</span>
                  <a
                    href={`/local-read?id=${encodeURIComponent(b.id)}&chapter=1`}
                    className="text-xs font-bold text-orange-dark flex items-center gap-1 hover:underline"
                  >
                    Read Local Book <span>→</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Soma Platform Protected Offline Downloads */}
      <div className="protected-downloads-section mt-4">
        <h4 className="font-bold text-base text-ink mb-3 flex items-center gap-2">
          <span>🔒</span> Soma Protected Downloads ({offlineGroups.length})
        </h4>

        {offlineGroups.length === 0 ? (
          <div className="empty-state">
            <div className="offline-icon">↓</div>
            <h2>{t("noDownloads")}</h2>
            <p>{t("noDownloadsText")}</p>
            <Link href="/discover" className="button button-primary">
              {t("exploreStories")} <span>→</span>
            </Link>
          </div>
        ) : (
          <div className="offline-groups">
            {offlineGroups.map((group) => (
              <section className="offline-group" key={group[0].bookSlug}>
                <div>
                  <p className="eyebrow">{t("offlineStories")}</p>
                  <h2>{group[0].bookSlug.replaceAll("-", " ")}</h2>
                  <p>{t("downloadedChapters", { count: group.length })} (Encrypted Package)</p>
                </div>
                <button
                  type="button"
                  className="text-button"
                  onClick={async () => {
                    await deleteOfflineBook(group[0].bookSlug);
                    void refresh();
                  }}
                >
                  {t("removeDownloads")}
                </button>
                <div className="offline-chapter-list">
                  {group
                    .sort((a, b) => a.chapterNumber - b.chapterNumber)
                    .map((chapter) => (
                      <a key={chapter.key} href={`/read/${chapter.bookSlug}/${chapter.chapterNumber}`}>
                        <span>{String(chapter.chapterNumber).padStart(2, "0")}</span>
                        {chapter.title}
                        <b>→</b>
                      </a>
                    ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
