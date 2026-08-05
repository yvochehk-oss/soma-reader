import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { MobileHeader } from './components/MobileHeader';
import { QuickEntryGrid } from './components/QuickEntryGrid';
import { EditorsChoiceHero } from './components/EditorsChoiceHero';
import { TopRankings } from './components/TopRankings';
import { BilingualBanner } from './components/BilingualBanner';
import { PopularGrid } from './components/PopularGrid';
import { MobileBottomNav } from './components/MobileBottomNav';
import { BookDetailModal } from './components/BookDetailModal';
import { ReaderModal } from './components/ReaderModal';
import { LibraryModal } from './components/LibraryModal';
import { ImportLocalBookModal } from './components/ImportLocalBookModal';
import { Footer } from './components/Footer';

import { Book, Chapter, Language, ActiveNavTab, UserLibraryItem } from './types';
import { GoogleAdBanner } from './components/GoogleAdBanner';
import { getAllLocalImportedBooks } from './lib/local-book-parser';
import { fetchBookChaptersFromSupabase, fetchLiveBooksFromSupabase, selectLocalizedBooks } from './lib/supabase-books';

const CATEGORIES = ['All', 'Romance', 'Thriller', 'Sci-Fi', 'Historical', 'Fantasy', 'Contemporary', 'Urban Fantasy'];

function readerLocation(book: Book, chapter: Chapter) {
  const url = new URL(window.location.href);
  url.searchParams.set('book', book.id);
  url.searchParams.set('chapter', String(chapter.number));
  return `${url.pathname}${url.search}${url.hash}`;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveNavTab>('Home');
  const [language, setLanguage] = useState<Language>('en');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [onlineBooks, setOnlineBooks] = useState<Book[]>([]);
  const [booksLoading, setBooksLoading] = useState(true);
  const [booksError, setBooksError] = useState<string | null>(null);
  const localizedOnlineBooks = useMemo(() => selectLocalizedBooks(onlineBooks, language), [onlineBooks, language]);

  // Modals & Drawers
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [readingBook, setReadingBook] = useState<Book | null>(null);
  const [readingChapter, setReadingChapter] = useState<Chapter | null>(null);
  const [alternateReadingChapter, setAlternateReadingChapter] = useState<Chapter | null>(null);

  // Import TXT/EPUB Modal
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [localImportedBooks, setLocalImportedBooks] = useState<Book[]>([]);

  useEffect(() => {
    loadLocalBooks();
    loadOnlineBooks();
  }, []);

  const loadOnlineBooks = async () => {
    setBooksLoading(true);
    setBooksError(null);
    try {
      setOnlineBooks(await fetchLiveBooksFromSupabase());
    } catch (error) {
      console.error('Failed to load Supabase books:', error);
      setOnlineBooks([]);
      setBooksError(language === 'sw' ? 'Maktaba haikuweza kupakiwa. Tafadhali jaribu tena.' : 'The library could not be loaded. Please try again.');
    } finally {
      setBooksLoading(false);
    }
  };

  const loadLocalBooks = async () => {
    try {
      const books = await getAllLocalImportedBooks();
      setLocalImportedBooks(books);
    } catch (e) {
      console.error('Failed to load local imported books:', e);
    }
  };

  // Library / Bookmarks
  const [isLibraryOpen, setIsLibraryOpen] = useState<boolean>(false);
  const [savedBookIds, setSavedBookIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('soma_saved_books');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('soma_saved_books', JSON.stringify(savedBookIds));
    } catch (e) {
      console.error(e);
    }
  }, [savedBookIds]);

  const toggleBookmark = (book: Book) => {
    setSavedBookIds((prev) =>
      prev.includes(book.id) ? prev.filter((id) => id !== book.id) : [...prev, book.id]
    );
  };

  const editorChoiceBook = localizedOnlineBooks.find((b) => b.isEditorChoice) || localizedOnlineBooks[0];

  const savedBooks = localizedOnlineBooks.filter((b) => savedBookIds.includes(b.id));

  // Handle Tab Filtering
  const getFilteredBooksForTab = () => {
    if (activeTab === 'Popular') {
      // Return all books sorted by rating (or just all books as requested)
      return localizedOnlineBooks;
    }
    if (activeTab === 'Romance' || activeTab === 'Thriller') {
      return localizedOnlineBooks.filter((b) => b.category.toLowerCase() === activeTab.toLowerCase());
    }
    if (activeTab === 'Free Zone') {
      return localizedOnlineBooks.filter((b) => b.status === 'Free' || b.status === 'Hot' || b.status === 'Bilingual');
    }
    if (activeTab === 'Completed') {
      return localizedOnlineBooks.filter((b) => b.status === 'Completed');
    }
    if (activeTab === 'Bilingual') {
      return localizedOnlineBooks.filter((b) => b.isBilingualAvailable);
    }
    return localizedOnlineBooks;
  };

  const displayedBooks = getFilteredBooksForTab();

  const tabTitle = language === 'sw'
    ? ({
        Home: 'Nyumbani',
        Romance: 'Mapenzi',
        Thriller: 'Kusisimua',
        Popular: 'Maarufu',
        Library: 'Maktaba',
        'Free Zone': 'Vitabu Huru',
        Completed: 'Vilivyokamilika',
        Bilingual: 'Lugha Mbili',
      } satisfies Record<ActiveNavTab, string>)[activeTab]
    : activeTab;

  const hydrateBook = async (book: Book) => {
    if (book.chapters.length > 0) return book;
    const chapters = await fetchBookChaptersFromSupabase(book);
    const hydrated = { ...book, chapters, chaptersCount: chapters.length };
    setOnlineBooks((current) => current.map((item) => item.databaseId === hydrated.databaseId ? hydrated : item));
    return hydrated;
  };

  useEffect(() => {
    if (booksLoading) return;
    let active = true;
    const restoreReaderFromUrl = async () => {
      const params = new URLSearchParams(window.location.search);
      const slug = params.get('book');
      const chapterNumber = Number(params.get('chapter'));
      if (!slug) {
        setReadingBook(null);
        setReadingChapter(null);
        setAlternateReadingChapter(null);
        return;
      }
      const book = onlineBooks.find((candidate) => candidate.id === slug);
      if (!book || !Number.isInteger(chapterNumber) || chapterNumber < 1) return;
      try {
        const hydrated = await hydrateBook(book);
        const chapter = hydrated.chapters.find((candidate) => candidate.number === chapterNumber);
        if (!active || !chapter) return;
        setReadingBook(hydrated);
        setReadingChapter(chapter);
        setAlternateReadingChapter(await loadAlternateReadingChapter(hydrated, chapter));
        window.history.replaceState({ somaReader: true }, '', readerLocation(hydrated, chapter));
      } catch (error) {
        console.error('Failed to restore reader URL:', error);
      }
    };
    const handlePopState = () => { void restoreReaderFromUrl(); };
    void restoreReaderFromUrl();
    window.addEventListener('popstate', handlePopState);
    return () => { active = false; window.removeEventListener('popstate', handlePopState); };
    // Run once after the live catalogue has loaded; popstate uses that catalogue snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booksLoading]);

  const handleSelectBook = async (book: Book) => {
    try {
      setSelectedBook(await hydrateBook(book));
    } catch (error) {
      console.error('Failed to load chapters:', error);
      setBooksError(language === 'sw' ? 'Sura hazikuweza kupakiwa.' : 'The chapters could not be loaded.');
    }
  };

  const handleStartReading = async (book: Book, chapter?: Chapter) => {
    setSelectedBook(null);
    try {
      const hydrated = await hydrateBook(book);
      const targetChapter = chapter ?? hydrated.chapters[0];
      if (!targetChapter) throw new Error('This book has no published chapters.');
      setReadingBook(hydrated);
      setReadingChapter(targetChapter);
      window.history.pushState({ somaReader: true }, '', readerLocation(hydrated, targetChapter));
      setAlternateReadingChapter(null);
      try {
        setAlternateReadingChapter(await loadAlternateReadingChapter(hydrated, targetChapter));
      } catch (error) {
        console.error('Failed to preload the paired chapter:', error);
      }
    } catch (error) {
      console.error('Failed to start reading:', error);
      setBooksError(language === 'sw' ? 'Kitabu hiki hakina sura zinazopatikana.' : 'This book has no available chapters.');
    }
  };

  const loadAlternateReadingChapter = async (book: Book, chapter: Chapter) => {
    const workId = book.parentBookId ?? book.databaseId;
    const alternate = onlineBooks.find((candidate) =>
      candidate.language !== book.language
      && (candidate.parentBookId ?? candidate.databaseId) === workId
    );
    if (!alternate) return null;

    const hydrated = await hydrateBook(alternate);
    return hydrated.chapters.find((candidate) => candidate.number === chapter.number) ?? null;
  };

  const handleSelectReadingChapter = async (chapter: Chapter) => {
    setReadingChapter(chapter);
    if (!readingBook) return;
    window.history.pushState({ somaReader: true }, '', readerLocation(readingBook, chapter));
    try {
      setAlternateReadingChapter(await loadAlternateReadingChapter(readingBook, chapter));
    } catch (error) {
      console.error('Failed to load the paired chapter:', error);
      setAlternateReadingChapter(null);
    }
  };

  const handleSwitchReadingLanguage = async (targetLanguage: Language) => {
    if (!readingBook || !readingChapter || readingBook.language === targetLanguage) return;
    const workId = readingBook.parentBookId ?? readingBook.databaseId;
    const targetBook = onlineBooks.find((candidate) =>
      candidate.language === targetLanguage
      && (candidate.parentBookId ?? candidate.databaseId) === workId
    );
    if (!targetBook) throw new Error(`No ${targetLanguage} edition is available for this book.`);

    const hydrated = await hydrateBook(targetBook);
    const targetChapter = hydrated.chapters.find((candidate) => candidate.number === readingChapter.number);
    if (!targetChapter) throw new Error(`Chapter ${readingChapter.number} is not available in the selected language.`);

    setLanguage(targetLanguage);
    setReadingBook(hydrated);
    setReadingChapter(targetChapter);
    window.history.replaceState({ somaReader: true }, '', readerLocation(hydrated, targetChapter));
    setAlternateReadingChapter(null);
    try {
      setAlternateReadingChapter(await loadAlternateReadingChapter(hydrated, targetChapter));
    } catch (error) {
      console.error('Failed to preload the paired chapter:', error);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F7F2] text-[#0a1f1d] font-sans-ui flex flex-col pt-[60px] md:pt-[70px] selection:bg-[#ed7248] selection:text-white overflow-x-hidden">
      {/* Desktop Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        language={language}
        setLanguage={setLanguage}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        allBooks={[...localImportedBooks, ...localizedOnlineBooks]}
        onSelectBook={handleSelectBook}
        savedBooksCount={savedBookIds.length + localImportedBooks.length}
        onOpenLibrary={() => setIsLibraryOpen(true)}
        onOpenImportModal={() => setIsImportModalOpen(true)}
      />

      {/* Mobile Header */}
      <MobileHeader
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        language={language}
        setLanguage={setLanguage}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        allBooks={[...localImportedBooks, ...localizedOnlineBooks]}
        onSelectBook={handleSelectBook}
        savedBooksCount={savedBookIds.length + localImportedBooks.length}
        onOpenLibrary={() => setIsLibraryOpen(true)}
        onOpenImportModal={() => setIsImportModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-12 pb-24 md:pb-16 pt-4 flex-1 flex flex-col gap-8 lg:gap-12">
        {/* Quick Entrance Grid */}
        <QuickEntryGrid
          language={language}
          onSelectTab={(tab) => {
            setActiveTab(tab);
            window.scrollTo({ top: 300, behavior: 'smooth' });
          }}
          onOpenImportModal={() => setIsImportModalOpen(true)}
        />

        {booksLoading && <div className="py-16 text-center text-sm font-semibold text-[#6E7E7A]" role="status">{language === 'sw' ? 'Inapakia maktaba…' : 'Loading the library…'}</div>}
        {!booksLoading && booksError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center" role="alert">
            <p className="text-sm font-semibold text-red-800">{booksError}</p>
            <button type="button" onClick={loadOnlineBooks} className="mt-3 rounded-full bg-[#a43d17] px-5 py-2 text-xs font-bold text-white">{language === 'sw' ? 'Jaribu tena' : 'Try again'}</button>
          </div>
        )}
        {!booksLoading && !booksError && localizedOnlineBooks.length === 0 && <div className="py-16 text-center text-sm font-semibold text-[#6E7E7A]" role="status">{language === 'sw' ? 'Hakuna vitabu vilivyochapishwa bado.' : 'No published books are available yet.'}</div>}

        {/* Home Screen Layout */}
        {!booksLoading && !booksError && editorChoiceBook && activeTab === 'Home' && (
          <>
            {/* Editor's Choice Hero Banner */}
            <EditorsChoiceHero
              book={editorChoiceBook}
              language={language}
              onReadNow={(book) => handleStartReading(book)}
              onSelectBook={handleSelectBook}
              isBookmarked={savedBookIds.includes(editorChoiceBook.id)}
            onToggleBookmark={toggleBookmark}
          />

          {/* Keep advertising below the first reading decision while ads load. */}
          <GoogleAdBanner slotId="5566778899" format="auto" className="my-0" />

          {/* Top Rankings */}
            <TopRankings
              books={localizedOnlineBooks}
              language={language}
              onSelectBook={handleSelectBook}
              onViewAllRankings={() => setActiveTab('Popular')}
            />

            {/* English & Kiswahili Banner */}
            <BilingualBanner
              language={language}
              setLanguage={setLanguage}
              onExploreBilingual={() => setActiveTab('Bilingual')}
            />

            {/* Popular Right Now */}
            <PopularGrid
              books={displayedBooks}
              language={language}
              onSelectBook={handleSelectBook}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              categories={CATEGORIES}
            />
          </>
        )}

        {/* Tab Sub-views (Romance, Thriller, Rankings, Free Zone, Completed, Bilingual) */}
        {!booksLoading && !booksError && localizedOnlineBooks.length > 0 && activeTab !== 'Home' && (
          <section className="flex flex-col gap-6 animate-in fade-in duration-300">
            <div className="flex items-center justify-between border-b border-[#dec0b7]/30 pb-4">
              <div>
                <h2 className="font-black text-2xl sm:text-3xl text-[#0a1f1d]">
                  {tabTitle}
                </h2>
                <p className="text-xs sm:text-sm text-[#6E7E7A] mt-1">
                  {language === 'sw'
                    ? `Orodha ya vitabu vya ${activeTab}`
                    : `Explore all curated web novels in ${activeTab}`}
                </p>
              </div>
              <button
                onClick={() => setActiveTab('Home')}
                className="text-xs font-bold text-[#a43d17] hover:underline"
              >
                ← {language === 'sw' ? 'Rudi Nyumbani' : 'Back to Home'}
              </button>
            </div>

            <PopularGrid
              books={displayedBooks}
              language={language}
              onSelectBook={handleSelectBook}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              categories={CATEGORIES}
            />
          </section>
        )}
      </main>

      {/* Footer */}
      <Footer language={language} />

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        language={language}
        onOpenLibrary={() => setIsLibraryOpen(true)}
        onOpenProfile={() => setIsLibraryOpen(true)}
      />

      {/* Modals & Slide-overs */}
      <BookDetailModal
        book={selectedBook}
        onClose={() => setSelectedBook(null)}
        language={language}
        onStartReading={handleStartReading}
        isBookmarked={selectedBook ? savedBookIds.includes(selectedBook.id) : false}
        onToggleBookmark={toggleBookmark}
      />

      <ReaderModal
        book={readingBook}
        chapter={readingChapter}
        onClose={() => {
          const url = new URL(window.location.href);
          url.searchParams.delete('book');
          url.searchParams.delete('chapter');
          window.history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`);
          setReadingBook(null);
          setReadingChapter(null);
          setAlternateReadingChapter(null);
        }}
        onSelectChapter={handleSelectReadingChapter}
        alternateChapter={alternateReadingChapter}
        onSwitchLanguage={handleSwitchReadingLanguage}
        language={language}
      />

      <LibraryModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        savedBooks={savedBooks}
        localImportedBooks={localImportedBooks}
        libraryItems={savedBookIds.map((id) => ({ bookId: id, progressPercent: 0, addedAt: '2026' }))}
        language={language}
        onSelectBook={handleSelectBook}
        onRemoveFromLibrary={(id) => setSavedBookIds((prev) => prev.filter((i) => i !== id))}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onRemoveLocalBook={(id) => setLocalImportedBooks((prev) => prev.filter((b) => b.id !== id))}
      />

      <ImportLocalBookModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        language={language}
        onBookImported={(newBook) => {
          setLocalImportedBooks((prev) => [newBook, ...prev]);
          setIsLibraryOpen(true);
        }}
      />
    </div>
  );
}
