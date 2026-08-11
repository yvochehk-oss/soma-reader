import React from 'react';
import { Book, Language } from '../types';
import { TrendingUp, Flame, ChevronRight } from 'lucide-react';

interface TopRankingsProps {
  books: Book[];
  language: Language;
  onSelectBook: (book: Book) => void;
  onViewAllRankings: () => void;
}

export const TopRankings: React.FC<TopRankingsProps> = ({
  books,
  language,
  onSelectBook,
  onViewAllRankings,
}) => {
  const categoryLabel = (category: string) => language === 'sw'
    ? ({ Romance: 'Mapenzi', Thriller: 'Kusisimua', 'Sci-Fi': 'Sayansi ya Kubuni', Historical: 'Kihistoria', Fantasy: 'Fantasia', Contemporary: 'Kisasa', 'Urban Fantasy': 'Fantasia ya Mjini' } as Record<string, string>)[category] ?? category
    : category;
  // Get top 3 ranked books
  const rankedBooks = books.filter((b) => b.rank).sort((a, b) => (a.rank || 0) - (b.rank || 0)).slice(0, 3);

  const rankBadges = [
    {
      gradient: 'from-[#FFC837] to-[#FF8008]',
      bgGlow: 'from-[#FFC837]/20 to-[#FF8008]/20',
      rankText: '1',
    },
    {
      gradient: 'from-[#E0E0E0] to-[#8A9EA7]',
      bgGlow: 'from-[#E0E0E0]/20 to-[#8A9EA7]/20',
      rankText: '2',
    },
    {
      gradient: 'from-[#F09819] to-[#ED6EA0]',
      bgGlow: 'from-[#F09819]/20 to-[#ED6EA0]/20',
      rankText: '3',
    },
  ];

  return (
    <section className="flex flex-col gap-6">
      <div className="flex justify-between items-end border-b border-[#dec0b7]/30 pb-4">
        <h3 className="font-extrabold text-2xl lg:text-3xl text-[#0a1f1d] flex items-center gap-2.5">
          {language === 'sw' ? 'Vitabu Maarufu' : 'Popular Books'}
          <TrendingUp className="w-6 h-6 text-[#FF8008]" />
        </h3>
        <button
          onClick={onViewAllRankings}
          className="text-sm lg:text-base font-semibold text-[#6E7E7A] hover:text-[#a43d17] flex items-center gap-1 transition-colors"
        >
          {language === 'sw' ? 'Tazama Zote' : 'View All'}
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {rankedBooks.map((book, index) => {
          const badge = rankBadges[index] || rankBadges[0];
          return (
            <button
              type="button"
              key={book.id}
              onClick={() => onSelectBook(book)}
              aria-label={`${language === 'sw' ? 'Fungua' : 'Open'} ${language === 'sw' && book.titleSwahili ? book.titleSwahili : book.title}`}
              className="flex w-full gap-4 p-5 rounded-2xl bg-white hover:shadow-xl transition-all relative border border-[#dec0b7]/30 overflow-hidden group hover:-translate-y-1 cursor-pointer text-left"
            >
              {/* Background Blur Glow */}
              <div
                className={`absolute -right-4 -top-4 w-28 h-28 bg-gradient-to-br ${badge.bgGlow} rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700`}
              />

              {/* Cover with Rank Badge */}
              <div className="relative shrink-0">
                <img
                  src={book.coverImage}
                  alt={book.title}
                  loading="lazy"
                  decoding="async"
                  width="210"
                  height="315"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=800&auto=format&fit=crop';
                  }}
                  className="w-[90px] lg:w-[105px] rounded-lg shadow-md object-cover aspect-[2/3] group-hover:shadow-xl transition-shadow"
                />
                <div
                  className={`absolute -top-3 -left-3 w-9 h-9 rounded-full bg-gradient-to-br ${badge.gradient} text-white font-black flex items-center justify-center border-2 border-white shadow-md text-base z-10`}
                >
                  {badge.rankText}
                </div>
              </div>

              {/* Content */}
              <div className="flex flex-col justify-between flex-1 z-10 min-w-0">
                <div>
                  <h4 className="font-bold text-base lg:text-lg text-[#0a1f1d] line-clamp-2 mb-1 group-hover:text-[#a43d17] transition-colors leading-snug">
                    {language === 'sw' && book.titleSwahili ? book.titleSwahili : book.title}
                  </h4>
                  <p className="text-xs text-[#6E7E7A] mb-2 font-medium">{book.author}</p>
                  <p className="text-xs text-[#57423b] line-clamp-2 leading-relaxed">
                    {language === 'sw' && book.descriptionSwahili
                      ? book.descriptionSwahili
                      : book.description}
                  </p>
                </div>

                <div className="flex items-center gap-2.5 mt-3 pt-2 border-t border-gray-100">
                  <span className="bg-[#d6ede9] text-[#0a1f1d] px-2 py-0.5 rounded text-[10px] lg:text-[11px] font-bold uppercase tracking-wider">
                    {categoryLabel(book.category)}
                  </span>
                  <span className="flex items-center text-[#C95631] text-xs font-extrabold ml-auto">
                    <Flame className="w-3.5 h-3.5 mr-0.5 fill-current" />
                    {book.heatMetric}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
