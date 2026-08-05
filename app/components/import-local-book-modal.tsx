"use client";

import { useState } from "react";
import { parseTxtFile, parseEpubFile, type ParsedLocalBook } from "@/app/lib/local-book-parser";
import { saveLocalBook } from "@/app/lib/local-library-store";
import { useTranslation } from "@/app/components/language-provider";

export function ImportLocalBookModal({
  isOpen,
  onClose,
  onImportSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [dragOver, setDragOver] = useState(false);

  if (!isOpen) return null;

  const handleFileSelect = async (file: File) => {
    const name = file.name.toLowerCase();
    if (!name.endsWith(".txt") && !name.endsWith(".epub")) {
      setErrorMsg("Please select a .txt or .epub file.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      let parsed: ParsedLocalBook;
      if (name.endsWith(".txt")) {
        parsed = await parseTxtFile(file);
      } else {
        parsed = await parseEpubFile(file);
      }

      await saveLocalBook(parsed);
      setLoading(false);
      onImportSuccess();
      onClose();
    } catch (err: any) {
      setLoading(false);
      setErrorMsg(err?.message || "Failed to parse local file.");
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-line relative animate-in fade-in zoom-in duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted hover:text-ink text-xl font-bold border-0 bg-transparent cursor-pointer"
        >
          ✕
        </button>

        <div className="flex items-center gap-3 mb-2">
          <span className="w-10 h-10 rounded-xl bg-primary-container/10 text-primary-container flex items-center justify-center text-xl font-bold">
            📂
          </span>
          <div>
            <h3 className="font-bold text-lg text-ink m-0">Import Local Book</h3>
            <p className="text-xs text-muted m-0">100% Stored Locally on this Device • Zero Server Upload</p>
          </div>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`mt-4 p-8 border-2 border-dashed rounded-xl text-center transition-all cursor-pointer ${
            dragOver ? "border-primary bg-primary-container/5" : "border-line hover:border-primary/50"
          }`}
        >
          {loading ? (
            <div className="py-4">
              <div className="animate-spin text-2xl mb-2">⏳</div>
              <p className="text-sm font-bold text-primary m-0">Parsing & Encrypting Locally...</p>
            </div>
          ) : (
            <div>
              <p className="text-2xl m-0 mb-2">📖</p>
              <p className="text-sm font-bold text-ink m-0">Drag & Drop TXT / EPUB here</p>
              <p className="text-xs text-muted mt-1 mb-4">Supports .txt and .epub formats</p>
              <label className="button button-primary cursor-pointer text-xs py-2 px-4 inline-block">
                Choose Local File
                <input
                  type="file"
                  accept=".txt,.epub"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                />
              </label>
            </div>
          )}
        </div>

        {errorMsg && <p className="text-xs text-red-500 mt-3 m-0 font-bold">{errorMsg}</p>}

        <div className="mt-4 pt-3 border-t border-line text-[11px] text-muted flex items-center gap-1.5">
          <span>🛡️</span>
          <span>Security guarantee: Imported books stay exclusively inside this browser &amp; app.</span>
        </div>
      </div>
    </div>
  );
}
