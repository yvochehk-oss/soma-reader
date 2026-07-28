import React, { useState, useRef } from 'react';
import { Language, Book } from '../types';
import { parseTxtFile, parseEpubFile, saveLocalImportedBook } from '../lib/local-book-parser';
import { X, Upload, FileText, CheckCircle2, ShieldCheck, AlertCircle, Loader2, Sparkles, BookOpen } from 'lucide-react';

interface ImportLocalBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  onBookImported: (book: Book) => void;
}

export const ImportLocalBookModal: React.FC<ImportLocalBookModalProps> = ({
  isOpen,
  onClose,
  language,
  onBookImported,
}) => {
  if (!isOpen) return null;

  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [parsedBook, setParsedBook] = useState<Book | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileProcess = async (file: File) => {
    setErrorMsg(null);
    setParsedBook(null);

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'txt' && ext !== 'epub') {
      setErrorMsg(
        language === 'sw'
          ? 'Tafadhali chagua faili la .txt au .epub pekee.'
          : 'Please select a valid .txt or .epub file.'
      );
      return;
    }

    setLoading(true);

    try {
      let book: Book;
      if (ext === 'txt') {
        const text = await file.text();
        book = parseTxtFile(file, text);
      } else {
        book = await parseEpubFile(file);
      }

      setParsedBook(book);
    } catch (err: any) {
      console.error('File parse error:', err);
      setErrorMsg(
        err.message ||
          (language === 'sw'
            ? 'Kushindwa kusoma faili hili. Tafadhali hakikisha ni kiolezo sahihi.'
            : 'Failed to parse file. Please verify file format integrity.')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileProcess(e.target.files[0]);
    }
  };

  const handleConfirmImport = async () => {
    if (!parsedBook) return;
    try {
      await saveLocalImportedBook(parsedBook);
      onBookImported(parsedBook);
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to store book in local browser storage.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#F8F7F2] w-full max-w-xl rounded-3xl shadow-2xl border border-[#dec0b7]/40 flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-6 bg-[#182625] text-white flex items-center justify-between border-b border-[#203432]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#ed7248] flex items-center justify-center text-white shadow-sm">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-lg">
                {language === 'sw' ? 'Ingiza Kitabu cha TXT / EPUB' : 'Import TXT / EPUB Ebook'}
              </h3>
              <p className="text-xs text-[#d0e7e4] flex items-center gap-1 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-[#026a65]" />
                <span>Zero Server Upload • 100% Private Local Storage</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex flex-col gap-6">
          {/* Drag & Drop Box */}
          {!parsedBook && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-[#a43d17] bg-[#ed7248]/10 scale-[1.01]'
                  : 'border-[#dec0b7]/60 hover:border-[#a43d17] hover:bg-white'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.epub"
                onChange={handleFileInputChange}
                className="hidden"
              />

              {loading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-10 h-10 text-[#a43d17] animate-spin" />
                  <p className="font-bold text-sm text-[#0a1f1d]">
                    {language === 'sw'
                      ? 'Inachambua sura na yaliyomo...'
                      : 'Parsing chapters & indexing content locally...'}
                  </p>
                </div>
              ) : (
                <>
                  <FileText className="w-12 h-12 text-[#a43d17] mb-3 opacity-80" />
                  <p className="font-bold text-base text-[#0a1f1d]">
                    {language === 'sw'
                      ? 'Buruta na udondoshe faili la TXT au EPUB hapa'
                      : 'Drag & drop your TXT or EPUB file here'}
                  </p>
                  <p className="text-xs text-[#6E7E7A] mt-1">
                    {language === 'sw'
                      ? 'au bofya hapa ili kuchagua kutoka kwa kompyuta au simu yako'
                      : 'or click to browse local files on your device'}
                  </p>

                  <div className="mt-4 flex gap-2">
                    <span className="text-[11px] font-extrabold bg-[#e1f8f5] text-[#026a65] px-3 py-1 rounded-full border border-[#dec0b7]/30">
                      .TXT Format
                    </span>
                    <span className="text-[11px] font-extrabold bg-[#ed7248]/10 text-[#a43d17] px-3 py-1 rounded-full border border-[#dec0b7]/30">
                      .EPUB Format
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Preview Parsed Book */}
          {parsedBook && (
            <div className="bg-white p-5 rounded-2xl border border-[#dec0b7]/40 shadow-sm flex items-start gap-4 animate-in fade-in">
              <img
                src={parsedBook.coverImage}
                alt={parsedBook.title}
                className="w-20 h-28 object-cover rounded-xl shadow-md border shrink-0"
              />
              <div className="flex-1 min-w-0">
                <span className="bg-[#026a65] text-white text-[10px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider mb-1 inline-block">
                  {parsedBook.category}
                </span>
                <h4 className="font-extrabold text-lg text-[#0a1f1d] truncate">
                  {parsedBook.title}
                </h4>
                <p className="text-xs text-[#6E7E7A]">{parsedBook.author}</p>

                <div className="mt-3 flex items-center gap-3 text-xs font-bold text-[#0a1f1d]">
                  <span className="bg-[#e1f8f5] text-[#026a65] px-2.5 py-1 rounded-full">
                    {parsedBook.chaptersCount} Chapters Detected
                  </span>
                  <span className="text-[#a43d17]">{parsedBook.heatMetric}</span>
                </div>

                <p className="text-xs text-[#57423b] mt-2 line-clamp-2 italic">
                  "{parsedBook.description}"
                </p>
              </div>
            </div>
          )}

          {/* Local Security Assurance Box */}
          <div className="bg-[#e1f8f5]/60 p-3.5 rounded-xl border border-[#dec0b7]/30 text-xs text-[#0a1f1d] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#026a65] shrink-0" />
              <span>
                {language === 'sw'
                  ? 'Faili linaloletwa linahifadhiwa kwenye kivinjari chako pekee.'
                  : 'Files are processed locally in memory & stored only in your browser storage.'}
              </span>
            </div>
            <span className="text-[10px] font-bold text-[#a43d17] uppercase tracking-wider shrink-0 ml-2">
              Zero Upload
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-white border-t border-[#dec0b7]/30 flex items-center justify-end gap-3">
          {parsedBook ? (
            <>
              <button
                onClick={() => setParsedBook(null)}
                className="px-4 py-2.5 rounded-full font-bold text-xs border border-[#dec0b7] text-[#0a1f1d] hover:bg-gray-100 transition-colors"
              >
                {language === 'sw' ? 'Badilisha Faili' : 'Choose Another File'}
              </button>
              <button
                onClick={handleConfirmImport}
                className="px-6 py-2.5 rounded-full font-bold text-xs bg-[#a43d17] text-white hover:bg-[#ed7248] transition-all flex items-center gap-1.5 shadow-md"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {language === 'sw' ? 'Hifadhi kwenye Maktaba' : 'Add to My Local Shelf'}
                </span>
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-full font-bold text-xs text-[#6E7E7A] hover:text-[#0a1f1d]"
            >
              {language === 'sw' ? 'Ghairi' : 'Cancel'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
