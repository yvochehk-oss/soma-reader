import React, { useState } from 'react';
import { Search, User, BookOpen, Globe, Bookmark, Upload, Download } from 'lucide-react';
import { ActiveNavTab, Language, Book } from '../types';

interface HeaderProps {
  activeTab: ActiveNavTab;
  setActiveTab: (tab: ActiveNavTab) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  allBooks: Book[];
  onSelectBook: (book: Book) => void;
  savedBooksCount: number;
  onOpenLibrary: () => void;
  onOpenImportModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  language,
  setLanguage,
  searchQuery,
  setSearchQuery,
  allBooks,
  onSelectBook,
  savedBooksCount,
  onOpenLibrary,
  onOpenImportModal,
}) => {
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const filteredSearchResults = searchQuery.trim()
    ? allBooks.filter(
        (b) =>
          b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (b.titleSwahili && b.titleSwahili.toLowerCase().includes(searchQuery.toLowerCase())) ||
          b.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
          b.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const navItems: { label: string; labelSwahili: string; tab: ActiveNavTab }[] = [
    { label: 'Home', labelSwahili: 'Nyumbani', tab: 'Home' },
    { label: 'Popular', labelSwahili: 'Maarufu', tab: 'Popular' },
  ];

  return (
    <header className="fixed top-0 w-full z-50 backdrop-blur-md bg-[#e7fefa]/95 border-b border-[#dec0b7]/30 hidden md:flex h-[70px]">
      <div className="flex items-center w-full max-w-[1440px] mx-auto px-8 h-full justify-between">
        {/* Logo & Main Nav */}
        <div className="flex items-center gap-10">
          <button
            onClick={() => {
              setActiveTab('Home');
              setSearchQuery('');
            }}
            className="font-black text-[32px] text-[#a43d17] tracking-tight shrink-0 hover:opacity-90 transition-opacity flex items-center gap-1.5"
          >
            Soma
          </button>

          <nav className="flex gap-8 items-center h-full">
            {navItems.map((item) => {
              const isActive = activeTab === item.tab;
              return (
                <button
                  key={item.tab}
                  onClick={() => {
                    setActiveTab(item.tab);
                    setSearchQuery('');
                  }}
                  className={`h-[70px] flex items-center px-1 font-medium transition-colors border-b-2 text-sm lg:text-base ${
                    isActive
                      ? 'text-[#a43d17] border-[#a43d17] font-bold'
                      : 'text-[#6E7E7A] border-transparent hover:text-[#ed7248]'
                  }`}
                >
                  {language === 'sw' ? item.labelSwahili : item.label}
                </button>
              );
            })}
            
            {/* Import Local Book Button in Main Nav */}
            {onOpenImportModal && (
              <button
                onClick={onOpenImportModal}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#ed7248] hover:bg-[#a43d17] text-white text-sm font-extrabold transition-all shadow-md shrink-0 cursor-pointer ml-2"
                title="Import TXT / EPUB Ebook"
              >
                <Upload className="w-4 h-4" />
                <span>{language === 'sw' ? 'Ingiza Kitabu' : 'Import Book'}</span>
              </button>
            )}
          </nav>
        </div>

        {/* Right Section: Search & Actions */}
        <div className="flex items-center gap-4 lg:gap-6">
          {/* Language Switch Pill */}
          <button
            onClick={() => setLanguage(language === 'en' ? 'sw' : 'en')}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#d0e7e4]/60 hover:bg-[#a0f1ea] text-sm font-extrabold text-[#0a1f1d] transition-all border border-[#dec0b7]/30"
            title="Toggle Language / Badilisha Lugha"
          >
            <Globe className="w-4 h-4 text-[#a43d17]" />
            <span>{language === 'en' ? 'English' : 'Kiswahili'}</span>
          </button>

          {/* Search Box */}
          <div className="relative group">
            <div className="relative flex items-center">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                placeholder={
                  language === 'sw' ? 'Tafuta vitabu, waandishi...' : 'Search books, authors...'
                }
                className="bg-[#e1f8f5] border-none rounded-full py-2.5 pl-11 pr-8 text-sm w-64 lg:w-80 focus:ring-2 focus:ring-[#a43d17] focus:bg-white transition-all shadow-inner placeholder:text-[#6E7E7A] text-[#0a1f1d]"
              />
              <Search className="w-4 h-4 absolute left-4 text-[#6E7E7A] group-focus-within:text-[#a43d17] transition-colors" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 text-xs text-[#6E7E7A] hover:text-[#0a1f1d]"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Live Search Popup */}
            {isSearchFocused && searchQuery.trim().length > 0 && (
              <div className="absolute top-full mt-2 left-0 right-0 bg-white rounded-2xl shadow-xl border border-[#dec0b7]/40 p-3 max-h-96 overflow-y-auto z-50 animate-in fade-in slide-in-from-top-2">
                {filteredSearchResults.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#6E7E7A] px-2">
                      {language === 'sw' ? 'Matokeo' : 'Matching Books'} ({filteredSearchResults.length})
                    </p>
                    {filteredSearchResults.map((book) => (
                      <button
                        key={book.id}
                        onClick={() => {
                          onSelectBook(book);
                          setSearchQuery('');
                        }}
                        className="flex items-center gap-3 p-2 rounded-xl hover:bg-[#e1f8f5] transition-colors text-left"
                      >
                        <img
                          src={book.coverImage}
                          alt={book.title}
                          className="w-10 h-14 object-cover rounded shadow-sm shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <h5 className="font-bold text-sm text-[#0a1f1d] truncate">
                            {language === 'sw' && book.titleSwahili ? book.titleSwahili : book.title}
                          </h5>
                          <p className="text-xs text-[#6E7E7A] truncate">
                            {book.author} • {book.category}
                          </p>
                        </div>
                        <span className="text-xs font-bold text-[#C95631] bg-[#FFF0EB] px-2 py-0.5 rounded">
                          ★ {book.rating}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-sm text-[#6E7E7A]">
                    {language === 'sw'
                      ? 'Hakuna vitabu vilivyopatikana.'
                      : 'No matching books found.'}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Library / Saved Items */}
          <button
            onClick={onOpenLibrary}
            className="relative w-11 h-11 rounded-full bg-[#d0e7e4] flex items-center justify-center text-[#0a1f1d] hover:bg-[#ed7248] hover:text-white transition-colors"
            title={language === 'sw' ? 'Maktaba Yangu' : 'My Library'}
          >
            <Bookmark className="w-5 h-5" />
            {savedBooksCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#a43d17] text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                {savedBooksCount}
              </span>
            )}
          </button>

          {/* Export Code ZIP */}
          <a
            href="/api/download-zip"
            download="soma-project.zip"
            className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-[#a43d17] text-white font-bold text-xs hover:bg-[#8b3313] transition-colors shadow-sm ml-1"
            title="Download full project source code as ZIP"
          >
            <Download className="w-4 h-4" />
            <span>{language === 'sw' ? 'Pakua Kod' : 'Export Code'}</span>
          </a>
        </div>
      </div>
    </header>
  );
};
