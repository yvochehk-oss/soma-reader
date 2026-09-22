import React from 'react';
import { Book, Language } from '../types';
import { ArrowRight, Bookmark, Flame } from 'lucide-react';

interface EditorsChoiceHeroProps {
  book: Book;
  language: Language;
  onReadNow: (book: Book) => void;
  onSelectBook: (book: Book) => void;
  isBookmarked: boolean;
  onToggleBookmark: (book: Book) => void;
}

export const EditorsChoiceHero: React.FC<EditorsChoiceHeroProps> = ({
  book,
  language,
  onReadNow,
  onSelectBook,
  isBookmarked,
  onToggleBookmark,
}) => {
  const categoryLabel = language === 'sw'
    ? ({ Romance: 'Mapenzi', Thriller: 'Kusisimua', 'Sci-Fi': 'Sayansi ya Kubuni', Historical: 'Kihistoria', Fantasy: 'Fantasia', Contemporary: 'Kisasa', 'Urban Fantasy': 'Fantasia ya Mjini' } as Record<string, string>)[book.category] ?? book.category
    : book.category;

  return (
    <section className="relative rounded-3xl overflow-hidden bg-white shadow-lg border border-[#dec0b7]/30 flex flex-col md:flex-row min-h-[400px] lg:min-h-[480px]">
      {/* Background Image Area */}
      <div className="w-full md:w-1/2 lg:w-[55%] h-[280px] md:h-auto relative overflow-hidden group">
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
          style={{ backgroundImage: `url('${book.bannerImage || book.coverImage}')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-white via-white/80 to-transparent lg:via-white/40" />
        <div className="absolute inset-0 bg-black/10 md:bg-transparent" />

        {/* Floating Book Cover */}
        <div className="absolute bottom-4 left-6 md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:left-12 lg:left-16 flex gap-4 items-end z-20">
          <button
            type="button"
            onClick={() => onSelectBook(book)}
            aria-label={`${language === 'sw' ? 'Fungua' : 'Open'} ${language === 'sw' && book.titleSwahili ? book.titleSwahili : book.title}`}
            className="rounded-lg transform -rotate-2 hover:rotate-0 transition-transform duration-500"
          >
            <img
              src={book.coverImage}
              alt={book.title}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              width="420"
              height="630"
              className="w-[130px] md:w-[170px] lg:w-[210px] rounded-lg shadow-2xl object-cover object-top aspect-[3/4] border-4 border-white/40"
            />
          </button>
          <div className="bg-[#ed7248] text-white text-[11px] font-bold px-3 py-1.5 rounded-sm uppercase tracking-widest mb-4 hidden md:block shadow-md">
            {language === 'sw' ? 'Chaguo la Mhariri' : "Editor's Choice"}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="w-full md:w-1/2 lg:w-[45%] p-6 md:p-10 lg:p-14 flex flex-col justify-center bg-white relative z-10 md:bg-gradient-to-l from-white via-white to-transparent">
        <div className="bg-[#ed7248]/10 text-[#a43d17] text-[10px] font-bold px-2 py-1 rounded-sm uppercase tracking-wider w-max mb-3 md:hidden">
          {language === 'sw' ? 'Chaguo la Mhariri' : "Editor's Choice"}
        </div>

        <h2 className="font-bold text-2xl md:text-3xl lg:text-[40px] lg:leading-[1.1] text-[#0a1f1d] mb-3">
          <button type="button" onClick={() => onSelectBook(book)} className="text-left hover:text-[#a43d17] transition-colors">
            {language === 'sw' && book.titleSwahili ? book.titleSwahili : book.title}
          </button>
        </h2>

        <div className="flex items-center gap-3 text-sm lg:text-base text-[#6E7E7A] mb-5 flex-wrap">
          <span className="font-semibold text-[#a43d17]">{book.author}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#dec0b7]" />
          <span>{categoryLabel}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#dec0b7]" />
          <span className="flex items-center text-[#C95631] text-sm font-bold">
            <Flame className="w-4 h-4 mr-1 fill-current" />
            {book.heatMetric}
          </span>
        </div>

        <p className="font-serif-reader text-sm lg:text-base text-[#57423b] line-clamp-3 lg:line-clamp-4 mb-6 leading-relaxed">
          {language === 'sw' && book.descriptionSwahili
            ? book.descriptionSwahili
            : book.description}
        </p>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => onReadNow(book)}
            className="bg-[#ed7248] text-white px-8 lg:px-10 py-3.5 rounded-full font-bold text-xs lg:text-sm uppercase tracking-wide orange-glow hover:bg-[#C95631] hover:-translate-y-0.5 transition-all flex items-center gap-2"
          >
            {language === 'sw' ? 'Soma Sasa' : 'Read Now'}
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => onToggleBookmark(book)}
            aria-label={isBookmarked
              ? (language === 'sw' ? 'Ondoa kwenye maktaba' : 'Remove from library')
              : (language === 'sw' ? 'Ongeza kwenye maktaba' : 'Add to library')}
            className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all ${
              isBookmarked
                ? 'bg-[#a43d17] border-[#a43d17] text-white'
                : 'border-[#dec0b7]/60 text-[#6E7E7A] hover:bg-[#e7fefa] hover:text-[#a43d17] hover:border-[#a43d17]/40'
            }`}
            title={isBookmarked ? 'In Library' : 'Add to Library'}
          >
            <Bookmark className={`w-5 h-5 ${isBookmarked ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>
    </section>
  );
};
