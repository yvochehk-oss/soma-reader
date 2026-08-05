import React from 'react';
import { Language } from '../types';

interface FooterProps {
  language: Language;
}

export const Footer: React.FC<FooterProps> = ({ language }) => {
  return (
    <footer className="w-full bg-[#182625] text-[#d0e7e4] pt-12 pb-24 md:pb-12 border-t border-[#203432]">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        <div>
          <h2 className="font-black text-3xl text-[#ed7248] tracking-tight">Soma</h2>
          <p className="text-xs text-[#6E7E7A] mt-2 max-w-sm leading-relaxed">
            {language === 'sw'
              ? 'Jukwaa kuu la riwaya za mtandaoni la Afrika Mashariki linalotoa hadithi halisi katika Kiingereza na Kiswahili.'
              : "East Africa's premier web novel reading destination, bringing localized stories in English and Kiswahili."}
          </p>
        </div>

        <div className="flex gap-8 text-xs font-semibold text-[#e7fefa]">
          <a href="/books/" className="hover:text-[#ed7248] transition-colors">
            {language === 'sw' ? 'Vinjari vitabu' : 'Browse books'}
          </a>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 mt-8 pt-6 border-t border-[#203432] text-center md:text-left text-[11px] text-[#6E7E7A] flex flex-col sm:flex-row justify-between items-center gap-4">
        <span>© 2026 Soma Web Novels Inc. Crafted for Kenya & East Africa.</span>
        <span>Built with Google AI Studio & Gemini.</span>
      </div>
    </footer>
  );
};
