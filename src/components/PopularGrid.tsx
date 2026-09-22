import React from 'react';
import { Book, Language } from '../types';
import { Flame } from 'lucide-react';
import { optimizedCoverUrl, responsiveCoverSourceSet } from '../lib/image-delivery';

interface PopularGridProps {
  books: Book[];
  language: Language;
  onSelectBook: (book: Book) => void;
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  categories: string[];
  heading?: string;
  emptyMessage?: string;
}

export const PopularGrid: React.FC<PopularGridProps> = ({
  books,
  language,
  onSelectBook,
  selectedCategory,
  onSelectCategory,
  categories,
  heading,
  emptyMessage,
}) => {
  const categoryLabel = (category: string) => {
    if (language !== 'sw') return category;
    return ({
      All: 'Zote',
      Romance: 'Mapenzi',
      Thriller: 'Kusisimua',
      'Sci-Fi': 'Sayansi ya Kubuni',
      Historical: 'Kihistoria',
      Fantasy: 'Fantasia',
      Contemporary: 'Kisasa',
      'Urban Fantasy': 'Fantasia ya Mjini',
    } as Record<string, string>)[category] ?? category;
  };

  const filteredBooks =
    selectedCategory === 'All'
      ? books
      : books.filter((b) => b.category === selectedCategory);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-[#dec0b7]/30 pb-4 gap-4">
        <h3 className="font-extrabold text-2xl lg:text-3xl text-[#0a1f1d]">
          {heading ?? (language === 'sw' ? 'Mwelekeo wa Sasa' : 'Popular Right Now')}
        </h3>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => onSelectCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-[#a43d17] text-white shadow-xs'
                  : 'bg-white border border-[#dec0b7]/40 text-[#6E7E7A] hover:bg-[#e1f8f5] hover:text-[#0a1f1d]'
              }`}
            >
              {categoryLabel(cat)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-5 gap-y-8 lg:gap-x-7 lg:gap-y-10">
        {filteredBooks.map((book) => (
          <button
            type="button"
            key={book.id}
            onClick={() => onSelectBook(book)}
            aria-label={`${language === 'sw' ? 'Fungua' : 'Open'} ${language === 'sw' && book.titleSwahili ? book.titleSwahili : book.title}`}
            className="flex w-full flex-col gap-2.5 group cursor-pointer text-left rounded-xl focus-visible:ring-4 focus-visible:ring-[#a43d17]/25"
          >
            <div className="relative w-full aspect-[3/4] rounded-xl overflow-hidden shadow-sm group-hover:shadow-xl transition-all duration-300 group-hover:-translate-y-1 bg-gray-100">
              <img
                src={optimizedCoverUrl(book.coverImage, 480)}
                srcSet={responsiveCoverSourceSet(book.coverImage)}
                sizes="(min-width: 1280px) 220px, (min-width: 768px) 25vw, 45vw"
                alt={book.title}
                loading="lazy"
                fetchPriority="low"
                decoding="async"
                width="400"
                height="600"
                onError={(e) => {
                  const image = e.currentTarget;
                  image.removeAttribute('srcset');
                  image.removeAttribute('sizes');
                  if (image.dataset.originalFallback !== 'true') {
                    image.dataset.originalFallback = 'true';
                    image.src = book.coverImage;
                    return;
                  }
                  image.onerror = null;
                  image.src = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=800&auto=format&fit=crop';
                }}
                className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
              />

              {/* Status Badge */}
              {book.status === 'Hot' && (
                <div className="absolute top-2.5 left-2.5 bg-black/75 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1 uppercase tracking-wider">
                  <Flame className="w-3 h-3 text-[#C95631] fill-current" />
                  Hot
                </div>
              )}
              {book.status === 'New' && (
                <div className="absolute top-2.5 left-2.5 bg-[#a43d17]/90 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">
                  New
                </div>
              )}
              {book.status === 'Bilingual' && (
                <div className="absolute top-2.5 left-2.5 bg-[#026a65]/90 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">
                  EN/SW
                </div>
              )}
            </div>

            <div>
              <h4 className="font-bold text-sm lg:text-base text-[#0a1f1d] line-clamp-2 leading-tight group-hover:text-[#a43d17] transition-colors">
                {language === 'sw' && book.titleSwahili ? book.titleSwahili : book.title}
              </h4>
              <p className="text-xs text-[#6E7E7A] mt-1 font-medium">{categoryLabel(book.category)}</p>
            </div>
          </button>
        ))}
      </div>
      {filteredBooks.length === 0 && emptyMessage && (
        <div className="rounded-2xl border border-dashed border-[#dec0b7]/50 bg-white/60 px-6 py-12 text-center text-sm font-semibold text-[#6E7E7A]">
          {emptyMessage}
        </div>
      )}
    </section>
  );
};
