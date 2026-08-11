import React, { useState } from 'react';
import { Menu, Search, Globe, Bookmark, X, Upload } from 'lucide-react';
import { ActiveNavTab, Language, Book } from '../types';

interface MobileHeaderProps {
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

export const MobileHeader: React.FC<MobileHeaderProps> = ({
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

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
    { label: 'English Classics', labelSwahili: 'Klasiki za Kiingereza', tab: 'Classics' },
    { label: 'Modern Web Novels', labelSwahili: 'Riwaya za Kisasa', tab: 'Modern' },
  ];

  return (
    <>
      <header className="fixed top-0 w-full z-50 backdrop-blur-md bg-[#e7fefa]/95 border-b border-[#dec0b7]/30 md:hidden flex h-[60px] items-center px-4 justify-between">
        <button
          onClick={() => setIsMenuOpen(true)}
          aria-label={language === 'sw' ? 'Fungua menyu' : 'Open menu'}
          aria-expanded={isMenuOpen}
          className="w-10 h-10 flex items-center justify-center text-[#0a1f1d] hover:text-[#a43d17]"
        >
          <Menu className="w-6 h-6" />
        </button>

        <button
          onClick={() => {
            setActiveTab('Home');
            setSearchQuery('');
          }}
          aria-label="Soma home"
          className="text-[24px] text-[#a43d17] font-black tracking-tight"
        >
          Soma
        </button>

        <div className="flex items-center gap-2">
          {onOpenImportModal && (
            <button
              onClick={onOpenImportModal}
              aria-label={language === 'sw' ? 'Ingiza kitabu' : 'Import ebook'}
              className="w-9 h-9 rounded-full bg-[#ed7248] text-white flex items-center justify-center hover:bg-[#a43d17] transition-colors"
              title="Import TXT/EPUB"
            >
              <Upload className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            aria-label={language === 'sw' ? 'Fungua utafutaji' : 'Open search'}
            aria-expanded={isSearchOpen}
            className="w-10 h-10 flex items-center justify-center text-[#0a1f1d] hover:text-[#a43d17]"
          >
            <Search className="w-5 h-5" />
          </button>
          
          <button
            onClick={onOpenLibrary}
            aria-label={language === 'sw' ? 'Fungua maktaba yangu' : 'Open my library'}
            className="relative w-9 h-9 rounded-full bg-[#d0e7e4] flex items-center justify-center text-[#0a1f1d]"
          >
            <Bookmark className="w-4 h-4" />
            {savedBooksCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#a43d17] text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {savedBooksCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Mobile Search Overlay Bar */}
      {isSearchOpen && (
        <div className="fixed top-[60px] left-0 right-0 z-40 bg-white border-b border-[#dec0b7]/40 p-3 shadow-md md:hidden animate-in slide-in-from-top duration-200">
          <div className="relative">
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === 'sw' ? 'Tafuta vitabu...' : 'Search books...'}
              className="w-full bg-[#e1f8f5] py-2 pl-10 pr-8 text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-[#a43d17]"
            />
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#6E7E7A]" />
            <button
              onClick={() => {
                setSearchQuery('');
                setIsSearchOpen(false);
              }}
              aria-label={language === 'sw' ? 'Funga utafutaji' : 'Close search'}
              className="absolute right-3 top-2.5 text-xs text-[#6E7E7A]"
            >
              ✕
            </button>
          </div>

          {searchQuery.trim().length > 0 && (
            <div className="mt-2 max-h-60 overflow-y-auto flex flex-col gap-2">
              {filteredSearchResults.map((book) => (
                <button
                  key={book.id}
                  onClick={() => {
                    onSelectBook(book);
                    setSearchQuery('');
                    setIsSearchOpen(false);
                  }}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-[#e1f8f5] text-left"
                >
                  <img
                    src={book.coverImage}
                    alt={book.title}
                    loading="lazy"
                    decoding="async"
                    width="32"
                    height="48"
                    className="w-8 h-12 object-cover rounded shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-xs text-[#0a1f1d] truncate">
                      {language === 'sw' && book.titleSwahili ? book.titleSwahili : book.title}
                    </p>
                    <p className="text-[11px] text-[#6E7E7A] truncate">{book.author}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mobile Drawer Navigation Menu */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-start md:hidden animate-in fade-in duration-200">
          <div className="w-4/5 max-w-xs bg-[#F8F7F2] h-full shadow-2xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-6 border-b border-[#dec0b7]/40">
                <span className="font-black text-2xl text-[#a43d17]">Soma</span>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  aria-label={language === 'sw' ? 'Funga menyu' : 'Close menu'}
                  className="p-1 rounded-full text-[#6E7E7A] hover:bg-gray-200"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="mt-6 flex flex-col gap-2">
                {onOpenImportModal && (
                  <button
                    onClick={() => {
                      onOpenImportModal();
                      setIsMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-3 rounded-xl font-extrabold text-sm bg-[#ed7248] text-white flex items-center justify-between shadow-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      <span>{language === 'sw' ? 'Ingiza Kitabu (TXT/EPUB)' : 'Import TXT/EPUB Ebook'}</span>
                    </div>
                    <span className="text-[10px] bg-white text-[#a43d17] px-1.5 py-0.5 rounded uppercase">
                      Local
                    </span>
                  </button>
                )}

                {navItems.map((item) => (
                  <button
                    key={item.tab}
                    onClick={() => {
                      setActiveTab(item.tab);
                      setIsMenuOpen(false);
                    }}
                    className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm transition-all ${
                      activeTab === item.tab
                        ? 'bg-[#ed7248] text-white'
                        : 'text-[#0a1f1d] hover:bg-[#e1f8f5]'
                    }`}
                  >
                    {language === 'sw' ? item.labelSwahili : item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-[#dec0b7]/40 flex flex-col gap-3">

              <button
                onClick={() => setLanguage(language === 'en' ? 'sw' : 'en')}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-full bg-[#d0e7e4] text-sm font-extrabold text-[#0a1f1d]"
              >
                <Globe className="w-5 h-5 text-[#a43d17]" />
                <span>{language === 'en' ? 'Switch to Kiswahili' : 'Badilisha kwenda English'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
