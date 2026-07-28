import React from 'react';
import { Language } from '../types';

interface BilingualBannerProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  onExploreBilingual: () => void;
}

export const BilingualBanner: React.FC<BilingualBannerProps> = ({
  language,
  setLanguage,
  onExploreBilingual,
}) => {
  return (
    <section className="w-full rounded-3xl overflow-hidden relative min-h-[190px] lg:min-h-[220px] flex items-center border border-[#dec0b7]/30 shadow-md">
      {/* Background Texture */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-50"
        style={{
          backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuCkHk5UTResjkwG4bUBlc9FNbekzJAfw5Nyrv0TcufaRN0ECw6oY7j2Fai6fIQ2MQucNo-tdFV6UUwsGPaXsT2yDmnf2Ho5LHYWuvmL8BXaEKwI_FNejH_xc_NzgqtT6iwChFGFJYT0yiP2x4YmxNjYSS0-abf23W9AxC7bNTjmnEzdddSPinSVv3SMlaUpyfPS1NCvMPDaoZxPXotDcESyeKmv-a_CVHGbK2fWZR5woxiffaxWROaJXLxEjkEvNed5-lLMp5khsAc')`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#d0e7e4]/95 via-[#d0e7e4]/85 to-transparent" />

      {/* Content */}
      <div className="relative z-10 p-6 md:p-10 lg:p-12 flex flex-col md:flex-row items-start md:items-center justify-between w-full gap-6">
        <div className="max-w-xl">
          <span className="text-[10px] uppercase font-extrabold tracking-widest text-[#a43d17] bg-white/80 px-2.5 py-1 rounded-full mb-2 inline-block shadow-xs">
            {language === 'sw' ? 'Msaada wa Lugha Mbili' : 'Bilingual Feature'}
          </span>
          <h3 className="font-extrabold text-2xl lg:text-3xl text-[#0a1f1d] mb-2">
            {language === 'sw'
              ? 'Soma kwa Kiingereza na Kiswahili'
              : 'Read in English & Kiswahili'}
          </h3>
          <p className="text-sm lg:text-base text-[#57423b] leading-relaxed">
            {language === 'sw'
              ? 'Badilisha bila kipingamizi kati ya lugha. Gundua hadithi za kienyeji zilizotengenezwa kwa ajili ya Afrika Mashariki.'
              : 'Switch seamlessly between languages. Discover localized stories tailored for East Africa.'}
          </p>
        </div>

        <div className="flex gap-2 bg-white/90 p-1.5 rounded-full border border-[#dec0b7]/40 shadow-inner shrink-0">
          <button
            onClick={() => setLanguage('en')}
            className={`px-6 lg:px-8 py-2.5 rounded-full font-bold text-xs lg:text-sm uppercase tracking-wider transition-all ${
              language === 'en'
                ? 'bg-[#ed7248] text-white shadow-sm'
                : 'text-[#6E7E7A] hover:text-[#0a1f1d] hover:bg-[#e1f8f5]'
            }`}
          >
            English
          </button>
          <button
            onClick={() => setLanguage('sw')}
            className={`px-6 lg:px-8 py-2.5 rounded-full font-bold text-xs lg:text-sm uppercase tracking-wider transition-all ${
              language === 'sw'
                ? 'bg-[#ed7248] text-white shadow-sm'
                : 'text-[#6E7E7A] hover:text-[#0a1f1d] hover:bg-[#e1f8f5]'
            }`}
          >
            Kiswahili
          </button>
        </div>
      </div>
    </section>
  );
};
