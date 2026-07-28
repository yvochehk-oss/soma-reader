import React, { useState, useEffect } from 'react';
import { Book, Chapter, Language } from '../types';
import { X, Flame, BookOpen, Bookmark, Sparkles, Globe, Calendar, Tag, Download, ShieldCheck, CheckCircle2, Loader2, Trash2 } from 'lucide-react';
import { saveChapterOfflineEncrypted, getOfflineBookStatus, deleteOfflineBook } from '../lib/offline-storage';

interface BookDetailModalProps {
  book: Book | null;
  onClose: () => void;
  language: Language;
  onStartReading: (book: Book, chapter: Chapter) => void;
  isBookmarked: boolean;
  onToggleBookmark: (book: Book) => void;
  onOpenAiAssistant: (book: Book, chapter?: Chapter) => void;
}

export const BookDetailModal: React.FC<BookDetailModalProps> = ({
  book,
  onClose,
  language,
  onStartReading,
  isBookmarked,
  onToggleBookmark,
  onOpenAiAssistant,
}) => {
  if (!book) return null;

  const [synopsisLang, setSynopsisLang] = useState<Language>(language);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);

  useEffect(() => {
    if (book) {
      checkOfflineStatus();
    }
  }, [book]);

  const checkOfflineStatus = async () => {
    if (!book) return;
    const status = await getOfflineBookStatus(book.id);
    setIsOffline(status.isOfflineAvailable && status.downloadedCount >= book.chapters.length);
  };

  const handleOfflineDownload = async () => {
    if (!book) return;
    setDownloading(true);
    setDownloadProgress(0);

    try {
      for (let i = 0; i < book.chapters.length; i++) {
        const ch = book.chapters[i];
        await saveChapterOfflineEncrypted(
          book.id,
          ch.id,
          ch.title,
          ch.content,
          ch.wordCount
        );
        setDownloadProgress(Math.round(((i + 1) / book.chapters.length) * 100));
      }
      setIsOffline(true);
    } catch (err) {
      console.error('Offline download failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  const handleRemoveOffline = async () => {
    if (!book) return;
    await deleteOfflineBook(book.id);
    setIsOffline(false);
  };

  const displayTitle = synopsisLang === 'sw' && book.titleSwahili ? book.titleSwahili : book.title;
  const displayDesc =
    synopsisLang === 'sw' && book.descriptionSwahili ? book.descriptionSwahili : book.description;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-[#F8F7F2] w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden relative max-h-[90vh] flex flex-col my-auto border border-[#dec0b7]/40">
        {/* Header / Banner */}
        <div className="relative h-48 sm:h-56 bg-cover bg-center" style={{ backgroundImage: `url('${book.bannerImage || book.coverImage}')` }}>
          <div className="absolute inset-0 bg-gradient-to-t from-[#F8F7F2] via-black/40 to-black/60" />
          
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black transition-colors z-20"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="absolute bottom-4 left-6 right-6 flex items-end gap-5">
            <img
              src={book.coverImage}
              alt={book.title}
              className="w-24 sm:w-32 aspect-[2/3] object-cover rounded-xl shadow-2xl border-2 border-white shrink-0"
            />
            <div className="text-white min-w-0 flex-1 drop-shadow-md">
              <span className="bg-[#ed7248] text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded uppercase tracking-wider mb-1 inline-block">
                {book.category}
              </span>
              <h2 className="font-extrabold text-xl sm:text-2xl lg:text-3xl line-clamp-2 leading-snug">
                {displayTitle}
              </h2>
              <p className="text-xs sm:text-sm text-gray-200 mt-1 font-medium">{book.author}</p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
          {/* Metadata Row */}
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-[#dec0b7]/30 text-xs sm:text-sm flex-wrap gap-3">
            <div className="flex items-center gap-1.5 text-[#C95631] font-bold">
              <Flame className="w-4 h-4 fill-current" />
              <span>{book.heatMetric}</span>
            </div>
            <div className="text-[#6E7E7A]">
              <span className="font-bold text-[#0a1f1d]">{book.chaptersCount}</span>{' '}
              {synopsisLang === 'sw' ? 'Sura' : 'Chapters'}
            </div>
            <div className="flex items-center gap-1 text-[#6E7E7A]">
              <Calendar className="w-4 h-4" />
              <span>{book.publishedYear}</span>
            </div>
            <div className="bg-[#e1f8f5] text-[#026a65] font-bold px-2.5 py-1 rounded-full text-xs">
              {book.status}
            </div>
          </div>

          {/* Protected Offline Download Control */}
          <div className="bg-white p-4 rounded-2xl border border-[#dec0b7]/30 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#026a65]/10 text-[#026a65] flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-[#0a1f1d] flex items-center gap-1.5">
                  <span>{synopsisLang === 'sw' ? 'Pakua kwa Nje ya Mtandao' : 'Protected Offline Download'}</span>
                  <span className="text-[10px] font-extrabold bg-[#026a65] text-white px-2 py-0.5 rounded-full">AES-GCM Encrypted</span>
                </h4>
                <p className="text-[11px] text-[#6E7E7A]">
                  {synopsisLang === 'sw'
                    ? 'Maudhui yanalindwa kwa usimbaji fiche na yanaweza kusomwa katika Soma pekee.'
                    : 'Chapters are encrypted into local IndexedDB and decrypted strictly in Soma Reader.'}
                </p>
              </div>
            </div>

            {downloading ? (
              <div className="flex items-center gap-2 bg-[#e1f8f5] text-[#026a65] px-4 py-2 rounded-full font-bold text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-[#a43d17]" />
                <span>Downloading {downloadProgress}%...</span>
              </div>
            ) : isOffline ? (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 px-3 py-1.5 rounded-full border border-green-200">
                  <CheckCircle2 className="w-4 h-4" />
                  {synopsisLang === 'sw' ? 'Imepakuliwa' : 'Offline Ready'}
                </span>
                <button
                  onClick={handleRemoveOffline}
                  className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
                  title="Delete Offline Copy"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleOfflineDownload}
                className="px-4 py-2 rounded-full bg-[#182625] text-white font-bold text-xs hover:bg-[#a43d17] transition-all flex items-center gap-1.5 shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>{synopsisLang === 'sw' ? 'Pakua Riwaya' : 'Download All Chapters'}</span>
              </button>
            )}
          </div>

          {/* Synopsis with Language Switcher */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-base text-[#0a1f1d]">
                {synopsisLang === 'sw' ? 'Muhtasari wa Kitabu' : 'Book Synopsis'}
              </h3>
              <div className="flex items-center gap-1 bg-[#d0e7e4]/60 p-1 rounded-full text-xs font-bold">
                <button
                  onClick={() => setSynopsisLang('en')}
                  className={`px-2.5 py-0.5 rounded-full transition-all ${
                    synopsisLang === 'en' ? 'bg-[#a43d17] text-white' : 'text-[#6E7E7A]'
                  }`}
                >
                  EN
                </button>
                <button
                  onClick={() => setSynopsisLang('sw')}
                  className={`px-2.5 py-0.5 rounded-full transition-all ${
                    synopsisLang === 'sw' ? 'bg-[#a43d17] text-white' : 'text-[#6E7E7A]'
                  }`}
                >
                  SW
                </button>
              </div>
            </div>
            <p className="font-serif-reader text-sm sm:text-base text-[#57423b] leading-relaxed bg-white p-4 rounded-2xl border border-[#dec0b7]/20">
              {displayDesc}
            </p>
          </div>

          {/* Tags */}
          {book.tags && book.tags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Tag className="w-4 h-4 text-[#6E7E7A]" />
              {book.tags.map((tag) => (
                <span
                  key={tag}
                  className="bg-[#e1f8f5] text-[#0a1f1d] text-xs font-semibold px-2.5 py-1 rounded-full border border-[#dec0b7]/30"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Chapter Directory */}
          <div>
            <h3 className="font-bold text-base text-[#0a1f1d] mb-3">
              {synopsisLang === 'sw' ? 'Orodha ya Sura' : 'Chapter Directory'}
            </h3>
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
              {book.chapters.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => onStartReading(book, ch)}
                  className="flex items-center justify-between p-3 rounded-xl bg-white hover:bg-[#e1f8f5] border border-[#dec0b7]/20 transition-colors text-left"
                >
                  <div>
                    <span className="font-bold text-xs text-[#a43d17] mr-2">
                      Chapter {ch.number}:
                    </span>
                    <span className="font-semibold text-sm text-[#0a1f1d]">
                      {synopsisLang === 'sw' && ch.titleSwahili ? ch.titleSwahili : ch.title}
                    </span>
                  </div>
                  <span className="text-xs text-[#6E7E7A] shrink-0 ml-2">{ch.wordCount} words</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-6 bg-white border-t border-[#dec0b7]/30 flex items-center justify-between gap-3">
          <button
            onClick={() => onToggleBookmark(book)}
            className={`px-4 py-3 rounded-full font-bold text-xs sm:text-sm flex items-center gap-2 border transition-all ${
              isBookmarked
                ? 'bg-[#a43d17] text-white border-[#a43d17]'
                : 'border-[#dec0b7] text-[#0a1f1d] hover:bg-[#e1f8f5]'
            }`}
          >
            <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
            <span className="hidden sm:inline">
              {isBookmarked
                ? synopsisLang === 'sw'
                  ? 'Imehifadhiwa'
                  : 'Saved to Library'
                : synopsisLang === 'sw'
                ? 'Hifadhi'
                : 'Save to Library'}
            </span>
          </button>

          <button
            onClick={() => onStartReading(book, book.chapters[0])}
            className="px-6 py-3 rounded-full font-bold text-xs sm:text-sm bg-[#ed7248] text-white hover:bg-[#C95631] transition-all flex items-center gap-2 shadow-md"
          >
            <BookOpen className="w-4 h-4" />
            <span>{synopsisLang === 'sw' ? 'Anza Kusoma' : 'Start Reading'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
