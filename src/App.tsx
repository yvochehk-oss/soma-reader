import React, { useState, useEffect } from 'react';
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
import { AiAssistantDrawer } from './components/AiAssistantDrawer';
import { LibraryModal } from './components/LibraryModal';
import { ImportLocalBookModal } from './components/ImportLocalBookModal';
import { Footer } from './components/Footer';

import { BOOKS_DATA, CATEGORIES } from './data/booksData';
import { Book, Chapter, Language, ActiveNavTab, UserLibraryItem } from './types';
import { getAllLocalImportedBooks } from './lib/local-book-parser';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveNavTab>('Home');
  const [language, setLanguage] = useState<Language>('en');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Modals & Drawers
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [readingBook, setReadingBook] = useState<Book | null>(null);
  const [readingChapter, setReadingChapter] = useState<Chapter | null>(null);

  // AI Assistant Drawer
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState<boolean>(false);
  const [aiBook, setAiBook] = useState<Book | null>(null);
  const [aiChapter, setAiChapter] = useState<Chapter | null>(null);

  // Import TXT/EPUB Modal
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [localImportedBooks, setLocalImportedBooks] = useState<Book[]>([]);

  useEffect(() => {
    loadLocalBooks();
  }, []);

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
      return stored ? JSON.parse(stored) : ['savannahs-secret', 'neon-savannah'];
    } catch {
      return ['savannahs-secret', 'neon-savannah'];
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

  const editorChoiceBook = BOOKS_DATA.find((b) => b.isEditorChoice) || BOOKS_DATA[0];

  const savedBooks = BOOKS_DATA.filter((b) => savedBookIds.includes(b.id));

  // Handle Tab Filtering
  const getFilteredBooksForTab = () => {
    if (activeTab === 'Popular') {
      // Return all books sorted by rating (or just all books as requested)
      return [...BOOKS_DATA].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }
    if (activeTab === 'Free Zone') {
      return BOOKS_DATA.filter((b) => b.status === 'Free' || b.status === 'Hot');
    }
    if (activeTab === 'Completed') {
      return BOOKS_DATA.filter((b) => b.status === 'Completed');
    }
    if (activeTab === 'Bilingual') {
      return BOOKS_DATA.filter((b) => b.isBilingualAvailable);
    }
    return BOOKS_DATA;
  };

  const displayedBooks = getFilteredBooksForTab();

  const handleStartReading = (book: Book, chapter: Chapter) => {
    setSelectedBook(null);
    setReadingBook(book);
    setReadingChapter(chapter);
  };

  const handleOpenAiAssistant = (book: Book, chapter?: Chapter) => {
    setAiBook(book);
    setAiChapter(chapter || book.chapters[0]);
    setIsAiAssistantOpen(true);
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
        allBooks={[...localImportedBooks, ...BOOKS_DATA]}
        onSelectBook={(book) => setSelectedBook(book)}
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
        allBooks={[...localImportedBooks, ...BOOKS_DATA]}
        onSelectBook={(book) => setSelectedBook(book)}
        savedBooksCount={savedBookIds.length + localImportedBooks.length}
        onOpenLibrary={() => setIsLibraryOpen(true)}
        onOpenImportModal={() => setIsImportModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-12 pb-24 md:pb-16 pt-6 flex-1 flex flex-col gap-12 lg:gap-16">
        {/* Quick Entrance Grid */}
        <QuickEntryGrid
          language={language}
          onSelectTab={(tab) => {
            setActiveTab(tab);
            window.scrollTo({ top: 300, behavior: 'smooth' });
          }}
          onOpenImportModal={() => setIsImportModalOpen(true)}
        />

        {/* Home Screen Layout */}
        {activeTab === 'Home' && (
          <>
            {/* Editor's Choice Hero Banner */}
            <EditorsChoiceHero
              book={editorChoiceBook}
              language={language}
              onReadNow={(book) => handleStartReading(book, book.chapters[0])}
              onSelectBook={(book) => setSelectedBook(book)}
              isBookmarked={savedBookIds.includes(editorChoiceBook.id)}
              onToggleBookmark={toggleBookmark}
            />

            {/* Top Rankings */}
            <TopRankings
              books={BOOKS_DATA}
              language={language}
              onSelectBook={(book) => setSelectedBook(book)}
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
              onSelectBook={(book) => setSelectedBook(book)}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              categories={CATEGORIES}
            />
          </>
        )}

        {/* Tab Sub-views (Romance, Thriller, Rankings, Free Zone, Completed, Bilingual) */}
        {activeTab !== 'Home' && (
          <section className="flex flex-col gap-6 animate-in fade-in duration-300">
            <div className="flex items-center justify-between border-b border-[#dec0b7]/30 pb-4">
              <div>
                <h2 className="font-black text-2xl sm:text-3xl text-[#0a1f1d]">
                  {activeTab}
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
              onSelectBook={(book) => setSelectedBook(book)}
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
        onOpenAiAssistant={handleOpenAiAssistant}
      />

      <ReaderModal
        book={readingBook}
        chapter={readingChapter}
        onClose={() => {
          setReadingBook(null);
          setReadingChapter(null);
        }}
        onSelectChapter={(ch) => setReadingChapter(ch)}
        language={language}
        onOpenAiAssistant={handleOpenAiAssistant}
      />

      <AiAssistantDrawer
        isOpen={isAiAssistantOpen}
        onClose={() => setIsAiAssistantOpen(false)}
        book={aiBook}
        chapter={aiChapter}
        language={language}
      />

      <LibraryModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        savedBooks={savedBooks}
        localImportedBooks={localImportedBooks}
        libraryItems={savedBookIds.map((id) => ({ bookId: id, progressPercent: 0, addedAt: '2026' }))}
        language={language}
        onSelectBook={(b) => setSelectedBook(b)}
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
