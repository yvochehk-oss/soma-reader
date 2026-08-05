import React, { useState } from 'react';
import { Book, Language, UserLibraryItem } from '../types';
import { X, Bookmark, Trash2, BookOpen, Upload, HardDrive, ShieldCheck, Download, Sparkles } from 'lucide-react';
import { deleteLocalImportedBook } from '../lib/local-book-parser';
import { deleteOfflineBook } from '../lib/offline-storage';

interface LibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedBooks: Book[];
  localImportedBooks: Book[];
  libraryItems: UserLibraryItem[];
  language: Language;
  onSelectBook: (book: Book) => void;
  onRemoveFromLibrary: (bookId: string) => void;
  onOpenImportModal: () => void;
  onRemoveLocalBook: (bookId: string) => void;
}

export const LibraryModal: React.FC<LibraryModalProps> = ({
  isOpen,
  onClose,
  savedBooks,
  localImportedBooks,
  libraryItems,
  language,
  onSelectBook,
  onRemoveFromLibrary,
  onOpenImportModal,
  onRemoveLocalBook,
}) => {
  const [activeTab, setActiveTab] = useState<'online' | 'local'>('online');

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="My personal library"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div className="bg-[#F8F7F2] w-full max-w-3xl rounded-3xl shadow-2xl border border-[#dec0b7]/40 flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-[#a43d17] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Bookmark className="w-6 h-6 fill-current text-[#FFC837]" />
            <div>
              <h3 className="font-black text-xl">
                {language === 'sw' ? 'Maktaba Yangu' : 'My Personal Library'}
              </h3>
              <p className="text-xs text-white/80">
                {language === 'sw'
                  ? 'Vitabu vilivyohifadhiwa na usomaji wa nje ya mtandao'
                  : 'Saved Web Novels & Local Imported Ebooks'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onOpenImportModal();
              }}
              className="px-3 py-1.5 rounded-full bg-white text-[#a43d17] font-bold text-xs flex items-center gap-1.5 hover:bg-[#e1f8f5] transition-all shadow-xs"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{language === 'sw' ? 'Ingiza Faili' : 'Import TXT/EPUB'}</span>
            </button>
            <button
              onClick={onClose}
              aria-label="Close library"
              className="p-1.5 rounded-full hover:bg-white/20 transition-colors text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Library Filter Tabs */}
        <div className="flex border-b border-[#dec0b7]/30 bg-white px-6">
          <button
            onClick={() => setActiveTab('online')}
            className={`py-3 px-4 font-bold text-xs sm:text-sm border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'online'
                ? 'border-[#a43d17] text-[#a43d17]'
                : 'border-transparent text-[#6E7E7A] hover:text-[#0a1f1d]'
            }`}
          >
            <Bookmark className="w-4 h-4" />
            <span>
              {language === 'sw' ? 'Riwaya za Mtandaoni' : 'Online Bookmarks'} ({savedBooks.length})
            </span>
          </button>

          <button
            onClick={() => setActiveTab('local')}
            className={`py-3 px-4 font-bold text-xs sm:text-sm border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'local'
                ? 'border-[#a43d17] text-[#a43d17]'
                : 'border-transparent text-[#6E7E7A] hover:text-[#0a1f1d]'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>
              {language === 'sw' ? 'Vitabu vya Local' : 'Local TXT / EPUB'} ({localImportedBooks.length})
            </span>
            <span className="text-[10px] font-extrabold bg-[#026a65] text-white px-1.5 py-0.5 rounded">
              Zero Upload
            </span>
          </button>
        </div>

        {/* List of Saved Books */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'online' && (
            savedBooks.length > 0 ? (
              savedBooks.map((book) => (
                <div
                  key={book.id}
                  className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-[#dec0b7]/30 shadow-xs hover:shadow-md transition-shadow"
                >
                  <img
                    src={book.coverImage}
                    alt={book.title}
                    loading="lazy"
                    decoding="async"
                    width="96"
                    height="144"
                    className="w-16 h-24 object-cover rounded-lg shadow-sm shrink-0 cursor-pointer"
                    onClick={() => {
                      onSelectBook(book);
                      onClose();
                    }}
                  />

                  <div className="flex-1 min-w-0">
                    <h4
                      onClick={() => {
                        onSelectBook(book);
                        onClose();
                      }}
                      className="font-bold text-base text-[#0a1f1d] hover:text-[#a43d17] transition-colors cursor-pointer truncate"
                    >
                      {language === 'sw' && book.titleSwahili ? book.titleSwahili : book.title}
                    </h4>
                    <p className="text-xs text-[#6E7E7A] mt-0.5">{book.author}</p>

                    <div className="mt-3 flex items-center gap-3">
                      <span className="text-xs font-bold text-[#026a65] bg-[#e1f8f5] px-2.5 py-0.5 rounded-full">
                        {book.category}
                      </span>
                      <span className="text-xs text-[#6E7E7A]">
                        {book.chaptersCount} {language === 'sw' ? 'sura' : 'chapters'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <button
                      onClick={() => {
                        onSelectBook(book);
                        onClose();
                      }}
                      className="px-4 py-2 rounded-full bg-[#ed7248] text-white font-bold text-xs hover:bg-[#C95631] transition-all flex items-center gap-1.5 shadow-xs"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>{language === 'sw' ? 'Soma' : 'Read'}</span>
                    </button>

                    <button
                      onClick={() => onRemoveFromLibrary(book.id)}
                      className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 font-medium p-1"
                      title="Remove from library"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">
                        {language === 'sw' ? 'Odoa' : 'Remove'}
                      </span>
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-[#6E7E7A]">
                <Bookmark className="w-12 h-12 mx-auto mb-3 opacity-30 text-[#a43d17]" />
                <p className="font-bold text-base text-[#0a1f1d]">
                  {language === 'sw' ? 'Maktaba yako haina vitabu' : 'Your Online Shelf is Empty'}
                </p>
                <p className="text-xs text-[#6E7E7A] mt-1">
                  {language === 'sw'
                    ? 'Bofya alama ya hifadhi kwenye kitabu chochote kile ili ukihifadhi hapa.'
                    : 'Click the bookmark icon on any web novel to save it to your list.'}
                </p>
              </div>
            )
          )}

          {activeTab === 'local' && (
            localImportedBooks.length > 0 ? (
              localImportedBooks.map((book) => (
                <div
                  key={book.id}
                  className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-[#dec0b7]/30 shadow-xs hover:shadow-md transition-shadow"
                >
                  <img
                    src={book.coverImage}
                    alt={book.title}
                    loading="lazy"
                    decoding="async"
                    width="96"
                    height="144"
                    className="w-16 h-24 object-cover rounded-lg shadow-sm shrink-0 cursor-pointer"
                    onClick={() => {
                      onSelectBook(book);
                      onClose();
                    }}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-extrabold bg-[#a43d17] text-white px-2 py-0.5 rounded uppercase">
                        {book.category}
                      </span>
                      <span className="text-[10px] font-bold text-[#026a65] bg-[#e1f8f5] px-2 py-0.5 rounded">
                        100% Local Storage
                      </span>
                    </div>

                    <h4
                      onClick={() => {
                        onSelectBook(book);
                        onClose();
                      }}
                      className="font-bold text-base text-[#0a1f1d] hover:text-[#a43d17] transition-colors cursor-pointer truncate"
                    >
                      {book.title}
                    </h4>
                    <p className="text-xs text-[#6E7E7A] mt-0.5">{book.author}</p>

                    <p className="text-xs text-[#57423b] mt-1 line-clamp-1 italic">
                      {book.description}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <button
                      onClick={() => {
                        onSelectBook(book);
                        onClose();
                      }}
                      className="px-4 py-2 rounded-full bg-[#ed7248] text-white font-bold text-xs hover:bg-[#C95631] transition-all flex items-center gap-1.5 shadow-xs"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>{language === 'sw' ? 'Soma' : 'Read Now'}</span>
                    </button>

                    <button
                      onClick={async () => {
                        await deleteLocalImportedBook(book.id);
                        onRemoveLocalBook(book.id);
                      }}
                      className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 font-medium p-1"
                      title="Delete local book"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">
                        {language === 'sw' ? 'Futa' : 'Delete'}
                      </span>
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-[#6E7E7A] flex flex-col items-center">
                <HardDrive className="w-12 h-12 mb-3 opacity-30 text-[#a43d17]" />
                <p className="font-bold text-base text-[#0a1f1d]">
                  {language === 'sw' ? 'Hujaingiza faili za TXT au EPUB' : 'No Local TXT/EPUB Ebooks Imported Yet'}
                </p>
                <p className="text-xs text-[#6E7E7A] mt-1 max-w-sm">
                  {language === 'sw'
                    ? 'Unaweza kuingiza vitabu vyako vya .txt au .epub moja kwa moja bila kupakia kwenye seva.'
                    : 'Import your personal .txt or .epub files directly into browser memory. Zero server upload.'}
                </p>
                <button
                  onClick={onOpenImportModal}
                  className="mt-4 px-5 py-2.5 rounded-full bg-[#a43d17] text-white font-bold text-xs flex items-center gap-2 hover:bg-[#ed7248] transition-all shadow-md"
                >
                  <Upload className="w-4 h-4" />
                  <span>{language === 'sw' ? 'Ingiza Faili Sasa' : 'Import TXT / EPUB Now'}</span>
                </button>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};
