import React from 'react';
import { Book, Language } from '../types';
import { Flame } from 'lucide-react';

interface PopularGridProps {
  books: Book[];
  language: Language;
  onSelectBook: (book: Book) => void;
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  categories: string[];
}

export const PopularGrid: React.FC<PopularGridProps> = ({
  books,
  language,
  onSelectBook,
  selectedCategory,
  onSelectCategory,
  categories,
}) => {
  const filteredBooks =
    selectedCategory === 'All'
      ? books
      : books.filter((b) => b.category === selectedCategory);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-[#dec0b7]/30 pb-4 gap-4">
        <h3 className="font-extrabold text-2xl lg:text-3xl text-[#0a1f1d]">
          {language === 'sw' ? 'Mwelekeo wa Sasa' : 'Popular Right Now'}
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
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-5 gap-y-8 lg:gap-x-7 lg:gap-y-10">
        {filteredBooks.map((book) => (
          <div
            key={book.id}
            onClick={() => onSelectBook(book)}
            className="flex flex-col gap-2.5 group cursor-pointer"
          >
            <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden shadow-sm group-hover:shadow-xl transition-all duration-300 group-hover:-translate-y-1 bg-gray-100">
              <img
                src={book.coverImage}
                alt={book.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
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
              <p className="text-xs text-[#6E7E7A] mt-1 font-medium">{book.category}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
