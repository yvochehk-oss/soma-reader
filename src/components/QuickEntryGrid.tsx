import React from 'react';
import { QUICK_NAVIGATION_ITEMS } from '../data/booksData';
import { ActiveNavTab, Language } from '../types';
import { Upload } from 'lucide-react';

interface QuickEntryGridProps {
  language: Language;
  onSelectTab: (tab: ActiveNavTab) => void;
  onOpenImportModal?: () => void;
}

export const QuickEntryGrid: React.FC<QuickEntryGridProps> = ({
  language,
  onSelectTab,
  onOpenImportModal,
}) => {
  return (
    <section className="w-full">
      <div className="flex justify-start sm:justify-center gap-4 sm:gap-6 md:gap-12 lg:gap-16 items-start md:items-center w-full px-4 overflow-x-auto py-2 no-scrollbar">
        {onOpenImportModal && (
          <button
            onClick={onOpenImportModal}
            className="flex flex-col items-center gap-2 md:gap-3 group transition-transform hover:-translate-y-1 shrink-0 focus:outline-none"
          >
            <div className="w-14 h-14 md:w-16 md:h-16 lg:w-20 lg:h-20 rounded-full flex items-center justify-center bg-[#e1f8f5] border border-[#dec0b7]/30 transition-all group-hover:bg-white group-hover:shadow-md group-hover:border-[#ed7248]/40 relative">
              <div className="absolute inset-2 md:inset-2.5 lg:inset-3 bg-white rounded-full flex items-center justify-center shadow-xs">
                <Upload className="w-4 h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 text-[#ed7248]" strokeWidth={2.5} />
              </div>
            </div>
            <span className="font-bold text-[11px] md:text-[12px] lg:text-[14px] text-[#0a1f1d] group-hover:text-[#a43d17] transition-colors text-center w-[68px] md:w-auto leading-[1.2] break-words md:whitespace-nowrap">
              {language === 'sw' ? 'Ingiza Kitabu' : 'Upload Ebook'}
            </span>
          </button>
        )}

        {QUICK_NAVIGATION_ITEMS.map((item, idx) => (
          <button
            key={idx}
            onClick={() => onSelectTab(item.tabName)}
            className="flex flex-col items-center gap-2 md:gap-3 group transition-transform hover:-translate-y-1 shrink-0 focus:outline-none"
          >
            <div className="w-14 h-14 md:w-16 md:h-16 lg:w-20 lg:h-20 rounded-full flex items-center justify-center bg-[#e1f8f5] border border-[#dec0b7]/30 transition-all group-hover:bg-white group-hover:shadow-md group-hover:border-[#ed7248]/40">
              <img
                src={item.iconUrl}
                alt={item.title}
                className="w-full h-full object-cover p-2.5 lg:p-3 rounded-full"
              />
            </div>
            <span className="font-bold text-[11px] md:text-[12px] lg:text-[14px] text-[#0a1f1d] group-hover:text-[#a43d17] transition-colors text-center w-[68px] md:w-auto leading-[1.2] break-words md:whitespace-nowrap">
              {language === 'sw' ? item.titleSwahili : item.title}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
};
