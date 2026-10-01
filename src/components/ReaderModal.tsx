import React, { useState, useEffect, useRef } from 'react';
import { Book, Chapter, ReaderSettings, Language } from '../types';
import { GoogleAdBanner } from './GoogleAdBanner';
import { getDecryptedChapterOffline } from '../lib/offline-storage';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Settings,
  AArrowDown,
  AArrowUp,
  ShieldCheck,
} from 'lucide-react';

interface ReaderModalProps {
  book: Book | null;
  chapter: Chapter | null;
  onClose: () => void;
  onSelectChapter: (chapter: Chapter) => void;
  alternateChapter: Chapter | null;
  onSwitchLanguage: (target: Language) => Promise<void>;
  language: Language;
}

export const ReaderModal: React.FC<ReaderModalProps> = ({
  book,
  chapter,
  onClose,
  onSelectChapter,
  alternateChapter,
  onSwitchLanguage,
  language,
}) => {
  const [settings, setSettings] = useState<ReaderSettings>({
    fontSize: 19,
    fontFamily: 'Georgia',
    theme: 'paper',
    lineHeight: 1.85,
    bilingualMode: false,
    spacing: 'comfortable',
  });

  const [isSwitchingLanguage, setIsSwitchingLanguage] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [decryptedText, setDecryptedText] = useState<string | null>(null);
  const [isOfflineLoaded, setIsOfflineLoaded] = useState<boolean>(false);
  const [readingProgress, setReadingProgress] = useState(0);

  // A classic book can be viewed through the bilingual UI, but its reader
  // must remain English-only when no paired Kiswahili chapter exists.
  const hasAlternateLanguage = Boolean(alternateChapter);
  
  // Immersive UI State
  const [isUiVisible, setIsUiVisible] = useState(true);
  const lastScrollY = useRef(0);
  const scrollContainerRef = useRef<HTMLElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const lastSwipeAt = useRef(0);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('soma-vite-reader-settings');
      if (!stored) return;
      const parsed = JSON.parse(stored) as Partial<ReaderSettings>;
      setSettings((current) => ({
        ...current,
        fontSize: typeof parsed.fontSize === 'number' ? Math.min(28, Math.max(14, parsed.fontSize)) : current.fontSize,
        fontFamily: parsed.fontFamily === 'Georgia' || parsed.fontFamily === 'Work Sans' ? parsed.fontFamily : current.fontFamily,
        theme: parsed.theme === 'paper' || parsed.theme === 'sepia' || parsed.theme === 'dark' ? parsed.theme : current.theme,
        lineHeight: typeof parsed.lineHeight === 'number' ? Math.min(2.1, Math.max(1.55, parsed.lineHeight)) : current.lineHeight,
        bilingualMode: typeof parsed.bilingualMode === 'boolean' ? parsed.bilingualMode : current.bilingualMode,
        spacing: parsed.spacing === 'compact' || parsed.spacing === 'comfortable' ? parsed.spacing : current.spacing,
      }));
    } catch {
      // Reader preferences are optional; malformed storage must never block reading.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem('soma-vite-reader-settings', JSON.stringify(settings));
    } catch {
      // Private browsing and storage restrictions should not affect the reader.
    }
  }, [settings]);

  useEffect(() => {
    if (!hasAlternateLanguage && settings.bilingualMode) {
      setSettings((current) => ({ ...current, bilingualMode: false }));
    }
  }, [hasAlternateLanguage, settings.bilingualMode]);

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
    
    // Auto-scroll to top when chapter changes
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
    lastScrollY.current = 0;
    setReadingProgress(0);
    setIsUiVisible(true); // Always show UI when entering a new chapter
    
    return () => {
      isMounted = false;
    };
  }, [book, chapter]);

  // Scroll detection for Immersive UI
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const currentScrollY = container.scrollTop;
      const scrollDifference = currentScrollY - lastScrollY.current;
      const maxScroll = Math.max(1, container.scrollHeight - container.clientHeight);
      setReadingProgress(Math.min(100, Math.max(0, Math.round((currentScrollY / maxScroll) * 100))));
      
      // If scrolling down significantly, hide UI
      if (scrollDifference > 15 && currentScrollY > 100) {
        setIsUiVisible(false);
        setShowSettingsPanel(false);
      } 
      // If scrolling up significantly, show UI
      else if (scrollDifference < -15) {
        setIsUiVisible(true);
      }
      
      lastScrollY.current = currentScrollY;
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [book, chapter]);

  const turnPage = (direction: 'previous' | 'next') => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const pageHeight = Math.max(240, Math.round(container.clientHeight * 0.84));
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    container.scrollBy({
      top: direction === 'next' ? pageHeight : -pageHeight,
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, select, textarea, button')) return;
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault();
        turnPage('previous');
      } else if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') {
        event.preventDefault();
        turnPage('next');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  if (!book || !chapter) return null;

  const currentChapterIndex = book.chapters.findIndex((c) => c.id === chapter.id);
  const prevChapter = currentChapterIndex > 0 ? book.chapters[currentChapterIndex - 1] : null;
  const nextChapter = currentChapterIndex < book.chapters.length - 1 ? book.chapters[currentChapterIndex + 1] : null;

  const activeContent = decryptedText || chapter.content;
  const displayLanguage = book.language ?? language;
  const displayBookTitle = displayLanguage === 'sw' ? book.titleSwahili ?? book.title : book.title;
  const displayChapterTitle = (item: Chapter) => item.title.replace(new RegExp(`^(?:chapter|sura)\\s+${item.number}\\s*[:.\\-–—]?\\s*`, 'i'), '').trim() || item.title;

  const switchLanguage = async (target: Language) => {
    if (target === displayLanguage || isSwitchingLanguage) return;
    setIsSwitchingLanguage(true);
    try {
      await onSwitchLanguage(target);
    } catch (error) {
      console.error('Failed to switch reading language:', error);
    } finally {
      setIsSwitchingLanguage(false);
    }
  };

  // Theme styling mapping
  const themeClasses = {
    paper: 'bg-[#F8F7F2] text-[#0a1f1d]',
    sepia: 'bg-[#fbf0d9] text-[#4d3e26]',
    dark: 'bg-[#121b1a] text-[#e7fefa]',
  };

  const headerThemeClasses = {
    paper: 'bg-[#F8F7F2]/95 border-[#dec0b7]/30 text-[#0a1f1d]',
    sepia: 'bg-[#fbf0d9]/95 border-[#d0c6b0]/40 text-[#4d3e26]',
    dark: 'bg-[#121b1a]/95 border-[#203432] text-[#e7fefa]',
  };
  
  // Render text by splitting into true <p> tags for better reading experience
  const renderParagraphs = (text: string) => {
    if (!text) return null;
    const paragraphs = text.split(/\n+/);
    
    // Dynamic spacing classes based on user setting
    const spacingClass = settings.spacing === 'compact'
      ? 'reader-paragraph reader-paragraph-compact'
      : 'reader-paragraph reader-paragraph-comfortable';
    
    const inline = (value: string) => value.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, partIndex) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={partIndex}>{part.slice(2, -2)}</strong>
        : <React.Fragment key={partIndex}>{part}</React.Fragment>
    );

    return paragraphs.map((p, index) => {
      const trimmed = p.trim();
      if (!trimmed) return null;

      // Handle markdown headers
      if (trimmed.startsWith('### ')) {
        return <h3 key={index} className="text-xl font-bold mt-8 mb-4 text-current/90">{inline(trimmed.replace(/^###\s+/, ''))}</h3>;
      }
      if (trimmed.startsWith('## ')) {
        return <h2 key={index} className="text-2xl font-bold mt-10 mb-4 text-current/90">{inline(trimmed.replace(/^##\s+/, ''))}</h2>;
      }
      if (trimmed.startsWith('# ')) {
        return <h1 key={index} className="text-3xl font-bold mt-12 mb-6 text-current/90">{inline(trimmed.replace(/^#\s+/, ''))}</h1>;
      }
      if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(trimmed)) return <hr key={index} className="my-10 border-current/20" />;

      return (
        <p key={index} className={spacingClass}>
          {inline(trimmed)}
        </p>
      );
    });
  };

  const handleReaderClick = (e: React.MouseEvent) => {
    if (Date.now() - lastSwipeAt.current < 500) return;
    // If user is selecting text, don't trigger navigation
    if (window.getSelection()?.toString().length) return;
    
    // If user clicked a button, link, or inside an ad, let it pass
    const target = e.target as HTMLElement;
    if (target.closest('button, a, select, iframe, .adsbygoogle')) return;

    const clickX = e.clientX;
    const width = window.innerWidth;

    if (clickX < width * 0.25) {
      turnPage('previous');
    } else if (clickX > width * 0.75) {
      turnPage('next');
    } else {
      setIsUiVisible(!isUiVisible);
      setShowSettingsPanel(false);
    }
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    if (event.touches.length !== 1 || window.visualViewport?.scale && window.visualViewport.scale > 1) {
      touchStart.current = null;
      return;
    }
    const touch = event.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || event.changedTouches.length !== 1 || window.getSelection()?.toString()) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.25) return;
    lastSwipeAt.current = Date.now();
    turnPage(deltaX < 0 ? 'next' : 'previous');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Book reader"
      className={`fixed inset-0 z-50 flex flex-col transition-colors duration-300 overflow-hidden ${themeClasses[settings.theme]}`}
    >
      
      {/* Top Header Controls (Animated) */}
      <header
        className={`absolute top-0 w-full z-40 flex items-center justify-between px-4 sm:px-8 h-16 border-b backdrop-blur-md transition-transform duration-300 ease-in-out ${
          isUiVisible ? 'translate-y-0' : '-translate-y-24'
        } ${headerThemeClasses[settings.theme]}`}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            aria-label="Close reader"
            className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            title="Exit Reader"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="hidden sm:block min-w-0">
            <h4 className="font-bold text-sm truncate">{displayBookTitle}</h4>
            <p className="text-xs opacity-75 truncate">Chapter {chapter.number}: {displayChapterTitle(chapter)}</p>
          </div>
        </div>

        {/* Center: Chapter Selector */}
        <div className="flex items-center gap-2">
          <button
            disabled={!prevChapter}
            onClick={() => prevChapter && onSelectChapter(prevChapter)}
            aria-label="Previous chapter"
            title="Previous chapter"
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
            className="bg-black/5 dark:bg-white/10 rounded-full px-3 py-1.5 text-xs font-bold focus:outline-none cursor-pointer max-w-[140px] sm:max-w-xs truncate"
          >
            {book.chapters.map((c) => (
              <option key={c.id} value={c.id} className="text-black bg-white">
                Ch {c.number}: {displayChapterTitle(c)}
              </option>
            ))}
          </select>

          <button
            disabled={!nextChapter}
            onClick={() => nextChapter && onSelectChapter(nextChapter)}
            aria-label="Next chapter"
            title="Next chapter"
            className="p-2 rounded-full disabled:opacity-30 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Right Actions: Formatting Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettingsPanel(!showSettingsPanel)}
            className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            title="Formatting Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>
      
      {/* Settings Panel (Animated) */}
      <div className={`absolute top-16 right-4 sm:right-8 z-50 bg-white dark:bg-[#1f2b2a] text-[#0a1f1d] dark:text-[#e7fefa] p-5 rounded-2xl shadow-2xl border border-[#dec0b7]/40 w-80 transition-all duration-300 ease-in-out ${
        isUiVisible && showSettingsPanel ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' : 'opacity-0 scale-95 -translate-y-4 pointer-events-none'
      }`}>
          <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700 mb-4">
            <h5 className="font-bold text-sm">Reader Customization</h5>
            <button onClick={() => setShowSettingsPanel(false)} className="text-xs opacity-60 font-bold uppercase tracking-wider">
              Done
            </button>
          </div>

          {/* Font Size */}
          <div className="mb-4">
            <label className="text-xs font-bold opacity-75 mb-1.5 block">Font Size</label>
            <div className="flex items-center justify-between bg-gray-100 dark:bg-black/20 p-1.5 rounded-xl">
              <button
                onClick={() => setSettings((s) => ({ ...s, fontSize: Math.max(14, s.fontSize - 2) }))}
                className="p-2 hover:bg-white dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <AArrowDown className="w-4 h-4" />
              </button>
              <span className="text-sm font-bold">{settings.fontSize}px</span>
              <button
                onClick={() => setSettings((s) => ({ ...s, fontSize: Math.min(28, s.fontSize + 2) }))}
                className="p-2 hover:bg-white dark:hover:bg-gray-700 rounded-lg transition-colors"
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
                className={`p-2 rounded-xl text-xs font-bold border transition-colors ${
                  settings.theme === 'paper' ? 'border-[#a43d17] bg-[#F8F7F2]' : 'border-gray-200 border-transparent bg-gray-100 dark:bg-black/20'
                }`}
              >
                Paper
              </button>
              <button
                onClick={() => setSettings((s) => ({ ...s, theme: 'sepia' }))}
                className={`p-2 rounded-xl text-xs font-bold border transition-colors ${
                  settings.theme === 'sepia' ? 'border-[#a43d17] bg-[#fbf0d9]' : 'border-gray-200 border-transparent bg-gray-100 dark:bg-black/20'
                }`}
              >
                Sepia
              </button>
              <button
                onClick={() => setSettings((s) => ({ ...s, theme: 'dark' }))}
                className={`p-2 rounded-xl text-xs font-bold border transition-colors ${
                  settings.theme === 'dark' ? 'border-[#ed7248] bg-[#121b1a] text-white' : 'border-gray-200 border-transparent bg-gray-100 dark:bg-black/20'
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
                className={`p-2 rounded-xl text-xs font-serif transition-colors ${
                  settings.fontFamily === 'Georgia' ? 'bg-[#a43d17] text-white' : 'bg-gray-100 dark:bg-black/20'
                }`}
              >
                Georgia Serif
              </button>
              <button
                onClick={() => setSettings((s) => ({ ...s, fontFamily: 'Work Sans' }))}
                className={`p-2 rounded-xl text-xs font-sans transition-colors ${
                  settings.fontFamily === 'Work Sans' ? 'bg-[#a43d17] text-white' : 'bg-gray-100 dark:bg-black/20'
                }`}
              >
                Work Sans
              </button>
            </div>
          </div>

          {/* Paragraph Spacing */}
          <div className="mb-4">
            <label className="text-xs font-bold opacity-75 mb-1.5 block">Paragraph Spacing</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSettings((s) => ({ ...s, spacing: 'compact' }))}
                className={`p-2 rounded-xl text-xs font-bold transition-colors ${
                  settings.spacing === 'compact' ? 'bg-[#a43d17] text-white' : 'bg-gray-100 dark:bg-black/20'
                }`}
              >
                Compact
              </button>
              <button
                onClick={() => setSettings((s) => ({ ...s, spacing: 'comfortable' }))}
                className={`p-2 rounded-xl text-xs font-bold transition-colors ${
                  settings.spacing === 'comfortable' ? 'bg-[#a43d17] text-white' : 'bg-gray-100 dark:bg-black/20'
                }`}
              >
                Comfortable
              </button>
            </div>
          </div>

          {/* Bilingual Dual Mode Toggle (only when a paired chapter exists) */}
          {hasAlternateLanguage && <div>
            <label className="text-xs font-bold opacity-75 mb-1.5 block">Display Mode</label>
            <div className="flex items-center justify-between bg-gray-100 dark:bg-black/20 p-2 rounded-xl">
              <span className="text-xs font-bold">Parallel Dual Language</span>
              <input
                type="checkbox"
                checked={settings.bilingualMode}
                onChange={(e) => setSettings((s) => ({ ...s, bilingualMode: e.target.checked }))}
                className="w-4 h-4 accent-[#a43d17]"
              />
            </div>
          </div>}
      </div>

      {/* Language Bar (Animated along with header) */}
      <div className={`absolute top-16 w-full z-30 flex items-center justify-center gap-3 py-2 bg-black/5 dark:bg-white/5 border-b border-black/5 text-xs font-bold backdrop-blur-sm transition-transform duration-300 ease-in-out ${
        isUiVisible ? 'translate-y-0' : '-translate-y-24'
      }`}>
        <span>Language:</span>
        <button
          onClick={() => void switchLanguage('en')}
          disabled={isSwitchingLanguage || displayLanguage === 'en'}
          className={`px-3 py-1 rounded-full transition-all ${
            displayLanguage === 'en' ? 'bg-[#a43d17] text-white' : 'opacity-70'
          }`}
        >
          English
        </button>
        {hasAlternateLanguage && (
          <button
            onClick={() => void switchLanguage('sw')}
            disabled={isSwitchingLanguage || displayLanguage === 'sw'}
            className={`px-3 py-1 rounded-full transition-all ${
              displayLanguage === 'sw' ? 'bg-[#a43d17] text-white' : 'opacity-70'
            }`}
          >
            Kiswahili
          </button>
        )}

        {isOfflineLoaded && (
          <span className="ml-2 hidden sm:flex items-center gap-1 text-[11px] font-extrabold bg-[#026a65] text-white px-2.5 py-0.5 rounded-full">
            <ShieldCheck className="w-3 h-3" />
            AES Decrypted
          </span>
        )}
      </div>

      {/* Main Reader Scroll Container */}
      <main 
        ref={scrollContainerRef}
        onClick={handleReaderClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="reader-scroll flex-1 overflow-y-auto w-full relative pt-24 pb-32 scroll-smooth cursor-pointer"
      >
        {/* Text Constraint Container (max-w-2xl for optimal eye tracking) */}
        <div className="px-5 sm:px-10 py-8 max-w-[46rem] mx-auto w-full relative z-10 cursor-auto">
          {/* Chapter Title */}
          <div className="text-center mb-10 sm:mb-12 pb-7 border-b border-current/10">
            <p className="text-xs uppercase font-extrabold tracking-widest text-[#ed7248] mb-3">
              Chapter {chapter.number}
            </p>
            <h1 className="font-extrabold text-2xl sm:text-3xl lg:text-4xl mb-4 leading-tight text-balance">
              {displayChapterTitle(chapter)}
            </h1>
            <p className="text-sm opacity-60 font-medium tracking-wide">By {book.author}</p>
          </div>

          {/* Formatted Text Content */}
          <div
            style={{
              fontSize: `${settings.fontSize}px`,
              lineHeight: settings.lineHeight,
              fontFamily: settings.fontFamily === 'Georgia' ? 'Georgia, serif' : 'Work Sans, sans-serif',
            }}
            className="reader-copy select-text"
          >
            {settings.bilingualMode && alternateChapter ? (
              /* Parallel Dual View (Left/Right Side by Side) */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 p-6 rounded-3xl bg-black/5 dark:bg-white/5 border border-current/10">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-[#a43d17] mb-6 flex items-center gap-2">
                    <span className="w-4 h-px bg-[#a43d17]"></span> English
                  </p>
                  <div>{renderParagraphs(displayLanguage === 'en' ? activeContent : alternateChapter.content)}</div>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-[#026a65] mb-6 flex items-center gap-2">
                    <span className="w-4 h-px bg-[#026a65]"></span> Kiswahili
                  </p>
                  <div>
                    {renderParagraphs(displayLanguage === 'sw' ? activeContent : alternateChapter.content)}
                  </div>
                </div>
              </div>
            ) : (
              /* Standard Single Language Reading (Optimized Paragraphs) */
              <div>
                {renderParagraphs(activeContent)}
              </div>
            )}
          </div>
          
          <GoogleAdBanner slotId="6476924726" format="fluid" layout="in-article" className="my-12" />
          
        </div>
      </main>

      <button
        type="button"
        onClick={() => turnPage('previous')}
        disabled={readingProgress <= 0}
        aria-label="Previous page"
        title="Previous page"
        className={`reader-page-turn reader-page-turn-left ${isUiVisible ? 'reader-page-turn-visible' : ''}`}
      >
        <ChevronLeft aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => turnPage('next')}
        disabled={readingProgress >= 100}
        aria-label="Next page"
        title="Next page"
        className={`reader-page-turn reader-page-turn-right ${isUiVisible ? 'reader-page-turn-visible' : ''}`}
      >
        <ChevronRight aria-hidden="true" />
      </button>

      {/* Bottom Navigation Bar (Animated) */}
      <div className={`absolute bottom-0 w-full z-30 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t transition-transform duration-300 ease-in-out ${
        isUiVisible ? 'translate-y-0' : 'translate-y-full'
      } ${headerThemeClasses[settings.theme]}`}>
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <button
            disabled={!prevChapter}
            onClick={() => prevChapter && onSelectChapter(prevChapter)}
            className="flex-1 max-w-[200px] py-3.5 rounded-xl bg-black/10 dark:bg-white/10 disabled:opacity-30 font-bold text-xs flex justify-center items-center gap-2 hover:bg-[#ed7248] hover:text-white transition-all active:scale-95"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>
          
          <span className="text-xs font-bold opacity-60 whitespace-nowrap" aria-live="polite">
            Ch {chapter.number} · {readingProgress}%
          </span>

          <button
            disabled={!nextChapter}
            onClick={() => nextChapter && onSelectChapter(nextChapter)}
            className="flex-1 max-w-[200px] py-3.5 rounded-xl bg-[#ed7248] text-white disabled:opacity-30 font-bold text-xs flex justify-center items-center gap-2 hover:bg-[#C95631] transition-all shadow-lg active:scale-95"
          >
            <span>Next Chapter</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
