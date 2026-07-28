import React, { useState, useEffect } from 'react';
import { Book, Chapter, ReaderSettings, Language } from '../types';
import { getDecryptedChapterOffline } from '../lib/offline-storage';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Settings,
  Sparkles,
  Globe,
  AArrowDown,
  AArrowUp,
  Moon,
  Sun,
  BookOpen,
  ShieldCheck,
  HardDrive,
} from 'lucide-react';

interface ReaderModalProps {
  book: Book | null;
  chapter: Chapter | null;
  onClose: () => void;
  onSelectChapter: (chapter: Chapter) => void;
  language: Language;
  onOpenAiAssistant: (book: Book, chapter: Chapter) => void;
}

export const ReaderModal: React.FC<ReaderModalProps> = ({
  book,
  chapter,
  onClose,
  onSelectChapter,
  language,
  onOpenAiAssistant,
}) => {
  if (!book || !chapter) return null;

  const [settings, setSettings] = useState<ReaderSettings>({
    fontSize: 18,
    fontFamily: 'Georgia',
    theme: 'paper',
    lineHeight: 1.8,
    bilingualMode: false,
  });

  const [displayLanguage, setDisplayLanguage] = useState<Language>(language);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [decryptedText, setDecryptedText] = useState<string | null>(null);
  const [isOfflineLoaded, setIsOfflineLoaded] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    async function loadContent() {
      setDecryptedText(null);
      setIsOfflineLoaded(false);

      if (book && chapter) {
        const offlineText = await getDecryptedChapterOffline(book.id, chapter.id);
        if (isMounted && offlineText) {
          setDecryptedText(offlineText);
          setIsOfflineLoaded(true);
        }
      }
    }
    loadContent();
    return () => {
      isMounted = false;
    };
  }, [book, chapter]);

  const currentChapterIndex = book.chapters.findIndex((c) => c.id === chapter.id);
  const prevChapter = currentChapterIndex > 0 ? book.chapters[currentChapterIndex - 1] : null;
  const nextChapter =
    currentChapterIndex < book.chapters.length - 1 ? book.chapters[currentChapterIndex + 1] : null;

  const isLocalBook = book.id.startsWith('local-');
  const activeContent = decryptedText || chapter.content;

  // Theme styling mapping
  const themeClasses = {
    paper: 'bg-[#F8F7F2] text-[#0a1f1d]',
    sepia: 'bg-[#fbf0d9] text-[#4d3e26]',
    dark: 'bg-[#182625] text-[#e7fefa]',
  };

  const headerThemeClasses = {
    paper: 'bg-[#F8F7F2]/95 border-[#dec0b7]/30 text-[#0a1f1d]',
    sepia: 'bg-[#fbf0d9]/95 border-[#d0c6b0]/40 text-[#4d3e26]',
    dark: 'bg-[#182625]/95 border-[#203432] text-[#e7fefa]',
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col transition-colors duration-300 overflow-hidden ${
        themeClasses[settings.theme]
      }`}
    >
      {/* Top Header Controls */}
      <header
        className={`sticky top-0 z-30 flex items-center justify-between px-4 sm:px-8 h-16 border-b backdrop-blur-md transition-colors ${
          headerThemeClasses[settings.theme]
        }`}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            title="Exit Reader"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="hidden sm:block min-w-0">
            <h4 className="font-bold text-sm truncate">{book.title}</h4>
            <p className="text-xs opacity-75 truncate">
              Chapter {chapter.number}: {chapter.title}
            </p>
          </div>
        </div>

        {/* Center: Chapter Selector */}
        <div className="flex items-center gap-2">
          <button
            disabled={!prevChapter}
            onClick={() => prevChapter && onSelectChapter(prevChapter)}
            className="p-2 rounded-full disabled:opacity-30 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <select
            value={chapter.id}
            onChange={(e) => {
              const selected = book.chapters.find((c) => c.id === e.target.value);
              if (selected) onSelectChapter(selected);
            }}
            className="bg-black/5 dark:bg-white/10 rounded-full px-3 py-1.5 text-xs font-bold focus:outline-none cursor-pointer max-w-[160px] sm:max-w-xs truncate"
          >
            {book.chapters.map((c) => (
              <option key={c.id} value={c.id} className="text-black bg-white">
                Ch {c.number}: {c.title}
              </option>
            ))}
          </select>

          <button
            disabled={!nextChapter}
            onClick={() => nextChapter && onSelectChapter(nextChapter)}
            className="p-2 rounded-full disabled:opacity-30 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Right Actions: AI Companion & Formatting Controls */}
        <div className="flex items-center gap-2">
          {/* AI Assistant Button */}
          <button
            onClick={() => onOpenAiAssistant(book, chapter)}
            className="px-3 py-1.5 rounded-full bg-[#ed7248] text-white font-bold text-xs flex items-center gap-1.5 hover:bg-[#C95631] shadow-xs transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ask AI</span>
          </button>

          {/* Reader Settings Toggle */}
          <button
            onClick={() => setShowSettingsPanel(!showSettingsPanel)}
            className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors relative"
            title="Formatting Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Formatting Settings Drawer/Popup */}
      {showSettingsPanel && (
        <div className="absolute top-16 right-4 sm:right-8 z-40 bg-white dark:bg-[#203432] text-[#0a1f1d] dark:text-[#e7fefa] p-5 rounded-2xl shadow-2xl border border-[#dec0b7]/40 w-80 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700 mb-4">
            <h5 className="font-bold text-sm">Reader Customization</h5>
            <button onClick={() => setShowSettingsPanel(false)} className="text-xs opacity-60">
              Done
            </button>
          </div>

          {/* Font Size */}
          <div className="mb-4">
            <label className="text-xs font-bold opacity-75 mb-1.5 block">Font Size</label>
            <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-800 p-1.5 rounded-xl">
              <button
                onClick={() =>
                  setSettings((s) => ({ ...s, fontSize: Math.max(14, s.fontSize - 2) }))
                }
                className="p-2 hover:bg-white dark:hover:bg-gray-700 rounded-lg"
              >
                <AArrowDown className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold">{settings.fontSize}px</span>
              <button
                onClick={() =>
                  setSettings((s) => ({ ...s, fontSize: Math.min(28, s.fontSize + 2) }))
                }
                className="p-2 hover:bg-white dark:hover:bg-gray-700 rounded-lg"
              >
                <AArrowUp className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Theme Selector */}
          <div className="mb-4">
            <label className="text-xs font-bold opacity-75 mb-1.5 block">Theme</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setSettings((s) => ({ ...s, theme: 'paper' }))}
                className={`p-2 rounded-xl text-xs font-bold border ${
                  settings.theme === 'paper' ? 'border-[#a43d17] bg-[#F8F7F2]' : 'border-gray-200'
                }`}
              >
                Paper
              </button>
              <button
                onClick={() => setSettings((s) => ({ ...s, theme: 'sepia' }))}
                className={`p-2 rounded-xl text-xs font-bold border ${
                  settings.theme === 'sepia' ? 'border-[#a43d17] bg-[#fbf0d9]' : 'border-gray-200'
                }`}
              >
                Sepia
              </button>
              <button
                onClick={() => setSettings((s) => ({ ...s, theme: 'dark' }))}
                className={`p-2 rounded-xl text-xs font-bold border ${
                  settings.theme === 'dark' ? 'border-[#a43d17] bg-[#182625] text-white' : 'border-gray-200'
                }`}
              >
                Dark
              </button>
            </div>
          </div>

          {/* Font Family */}
          <div className="mb-4">
            <label className="text-xs font-bold opacity-75 mb-1.5 block">Font Family</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSettings((s) => ({ ...s, fontFamily: 'Georgia' }))}
                className={`p-2 rounded-xl text-xs font-serif ${
                  settings.fontFamily === 'Georgia' ? 'bg-[#a43d17] text-white' : 'bg-gray-100 dark:bg-gray-800'
                }`}
              >
                Georgia Serif
              </button>
              <button
                onClick={() => setSettings((s) => ({ ...s, fontFamily: 'Work Sans' }))}
                className={`p-2 rounded-xl text-xs font-sans ${
                  settings.fontFamily === 'Work Sans' ? 'bg-[#a43d17] text-white' : 'bg-gray-100 dark:bg-gray-800'
                }`}
              >
                Work Sans
              </button>
            </div>
          </div>

          {/* Bilingual Dual Mode Toggle */}
          <div>
            <label className="text-xs font-bold opacity-75 mb-1.5 block">Display Mode</label>
            <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-800 p-2 rounded-xl">
              <span className="text-xs font-bold">Parallel Dual Language</span>
              <input
                type="checkbox"
                checked={settings.bilingualMode}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, bilingualMode: e.target.checked }))
                }
                className="w-4 h-4 accent-[#a43d17]"
              />
            </div>
          </div>
        </div>
      )}

      {/* Language Bar Toggle */}
      <div className="flex items-center justify-center gap-3 py-2 bg-black/5 dark:bg-white/5 border-b border-black/5 text-xs font-bold">
        <span>Language:</span>
        <button
          onClick={() => setDisplayLanguage('en')}
          className={`px-3 py-1 rounded-full transition-all ${
            displayLanguage === 'en' ? 'bg-[#a43d17] text-white' : 'opacity-70'
          }`}
        >
          English
        </button>
        <button
          onClick={() => setDisplayLanguage('sw')}
          className={`px-3 py-1 rounded-full transition-all ${
            displayLanguage === 'sw' ? 'bg-[#a43d17] text-white' : 'opacity-70'
          }`}
        >
          Kiswahili
        </button>

        {isOfflineLoaded && (
          <span className="ml-2 flex items-center gap-1 text-[11px] font-extrabold bg-[#026a65] text-white px-2.5 py-0.5 rounded-full">
            <ShieldCheck className="w-3 h-3" />
            AES Decrypted Offline
          </span>
        )}

        {isLocalBook && (
          <span className="ml-2 flex items-center gap-1 text-[11px] font-extrabold bg-[#ed7248] text-white px-2.5 py-0.5 rounded-full">
            <HardDrive className="w-3 h-3" />
            Zero-Server Local Book
          </span>
        )}
      </div>

      {/* Reader Body Content */}
      <main className="flex-1 overflow-y-auto px-6 sm:px-12 md:px-24 lg:px-48 py-8 max-w-4xl mx-auto w-full">
        {/* Chapter Title */}
        <div className="text-center mb-10 pb-6 border-b border-current/10">
          <p className="text-xs uppercase font-extrabold tracking-widest text-[#ed7248] mb-2">
            Chapter {chapter.number}
          </p>
          <h1 className="font-extrabold text-2xl sm:text-3xl lg:text-4xl mb-2">
            {displayLanguage === 'sw' && chapter.titleSwahili ? chapter.titleSwahili : chapter.title}
          </h1>
          <p className="text-xs opacity-60 font-medium">By {book.author}</p>
        </div>

        {/* Text Container */}
        <div
          style={{
            fontSize: `${settings.fontSize}px`,
            lineHeight: settings.lineHeight,
            fontFamily: settings.fontFamily === 'Georgia' ? 'Georgia, serif' : 'Work Sans, sans-serif',
          }}
          className="space-y-6 select-text"
        >
          {settings.bilingualMode ? (
            /* Parallel Dual View */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-2xl bg-black/5 dark:bg-white/5">
              <div>
                <p className="text-xs font-bold uppercase text-[#a43d17] mb-2">English</p>
                <p className="whitespace-pre-line">{activeContent}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-[#026a65] mb-2">Kiswahili</p>
                <p className="whitespace-pre-line">
                  {chapter.contentSwahili || activeContent}
                </p>
              </div>
            </div>
          ) : (
            /* Standard Single Language Reading */
            <div className="whitespace-pre-line">
              {displayLanguage === 'sw' && chapter.contentSwahili
                ? chapter.contentSwahili
                : activeContent}
            </div>
          )}
        </div>

        {/* Bottom Chapter Navigation */}
        <div className="mt-16 pt-8 border-t border-current/10 flex items-center justify-between gap-4">
          <button
            disabled={!prevChapter}
            onClick={() => prevChapter && onSelectChapter(prevChapter)}
            className="px-5 py-2.5 rounded-full bg-black/10 dark:bg-white/10 disabled:opacity-30 font-bold text-xs flex items-center gap-2 hover:bg-[#ed7248] hover:text-white transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous Chapter</span>
          </button>

          <button
            disabled={!nextChapter}
            onClick={() => nextChapter && onSelectChapter(nextChapter)}
            className="px-5 py-2.5 rounded-full bg-[#ed7248] text-white disabled:opacity-30 font-bold text-xs flex items-center gap-2 hover:bg-[#C95631] transition-all shadow-md"
          >
            <span>Next Chapter</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </main>
    </div>
  );
};
