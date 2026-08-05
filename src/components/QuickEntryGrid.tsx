import React from 'react';
import { ActiveNavTab, Language } from '../types';
import { BadgeCheck, Gift, Languages, Trophy, Upload } from 'lucide-react';

const QUICK_NAVIGATION_ITEMS: Array<{
  title: string;
  titleSwahili: string;
  tabName: ActiveNavTab;
}> = [
  { title: 'Top Rated', titleSwahili: 'Bora Zaidi', tabName: 'Popular' },
  { title: 'Free Reads', titleSwahili: 'Vitabu Huru', tabName: 'Free Zone' },
  { title: 'Completed', titleSwahili: 'Vilivyokamilika', tabName: 'Completed' },
  { title: 'Bilingual', titleSwahili: 'Lugha Mbili', tabName: 'Bilingual' },
];

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
  const quickIcons = [Trophy, Gift, BadgeCheck, Languages];

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
            <span className="hidden sm:block font-bold text-[11px] md:text-[12px] lg:text-[14px] text-[#0a1f1d] group-hover:text-[#a43d17] transition-colors text-center w-[68px] md:w-auto leading-[1.2] break-words md:whitespace-nowrap">
              {language === 'sw' ? 'Ingiza Kitabu' : 'Upload Ebook'}
            </span>
          </button>
        )}

        {QUICK_NAVIGATION_ITEMS.map((item, idx) => {
          const Icon = quickIcons[idx] ?? Trophy;
          return (
          <button
            key={idx}
            onClick={() => onSelectTab(item.tabName)}
            className="flex flex-col items-center gap-2 md:gap-3 group transition-transform hover:-translate-y-1 shrink-0 focus:outline-none"
          >
            <div className="w-14 h-14 md:w-16 md:h-16 lg:w-20 lg:h-20 rounded-full flex items-center justify-center bg-[#e1f8f5] border border-[#dec0b7]/30 transition-all group-hover:bg-white group-hover:shadow-md group-hover:border-[#ed7248]/40">
              <Icon className="w-7 h-7 md:w-8 md:h-8 lg:w-10 lg:h-10 text-[#a43d17]" aria-hidden="true" />
            </div>
            <span className="hidden sm:block font-bold text-[11px] md:text-[12px] lg:text-[14px] text-[#0a1f1d] group-hover:text-[#a43d17] transition-colors text-center w-[68px] md:w-auto leading-[1.2] break-words md:whitespace-nowrap">
              {language === 'sw' ? item.titleSwahili : item.title}
            </span>
          </button>
          );
        })}
      </div>
    </section>
  );
};
