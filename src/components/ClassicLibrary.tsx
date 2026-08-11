import React from 'react';
import { Search, X } from 'lucide-react';
import { Book, Language } from '../types';
import { PopularGrid } from './PopularGrid';

const CLASSIC_CATEGORIES = ['All', 'Romance', 'Thriller', 'Sci-Fi', 'Historical', 'Fantasy', 'Contemporary', 'Urban Fantasy'];

interface ClassicLibraryProps {
  books: Book[];
  language: Language;
  onSelectBook: (book: Book) => void;
}

/**
 * The classics catalogue is intentionally separate from the modern web-novel
 * surface. Classics are English-only; `language` localizes this screen's UI,
 * not the book text or title.
 */
export const ClassicLibrary: React.FC<ClassicLibraryProps> = ({ books, language, onSelectBook }) => {
  const [selectedCategory, setSelectedCategory] = React.useState('All');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [visibleCount, setVisibleCount] = React.useState(10);
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase('en');
  const searchedBooks = React.useMemo(() => {
    if (!normalizedQuery) return books;

    return books.filter((book) => {
      const searchable = [
        book.title,
        book.author,
        book.category,
        book.description,
        book.publishedYear,
        ...book.tags,
      ].join(' ').toLocaleLowerCase('en');

      return searchable.includes(normalizedQuery);
    });
  }, [books, normalizedQuery]);

  const visibleBooks = React.useMemo(
    () => selectedCategory === 'All'
      ? searchedBooks
      : searchedBooks.filter((book) => book.category === selectedCategory),
    [searchedBooks, selectedCategory]
  );

  React.useEffect(() => {
    setVisibleCount(10);
  }, [normalizedQuery, selectedCategory]);

  const searchHasMatchesOutsideCategory = normalizedQuery.length > 0
    && searchedBooks.length > 0
    && visibleBooks.length === 0;

  const searchEmptyMessage = books.length === 0
    ? language === 'sw'
      ? 'Vitabu vya Kiingereza vya klasiki vitaonekana hapa vitakapopakiwa.'
      : 'English classic books will appear here when they are uploaded.'
    : searchHasMatchesOutsideCategory
      ? language === 'sw'
        ? `“${searchQuery.trim()}” ipo, lakini si katika aina ya sasa. Chagua aina nyingine au “Zote”.`
        : `“${searchQuery.trim()}” has matches, but not in this category. Choose another category or “All”.`
    : normalizedQuery
      ? language === 'sw'
        ? `Hakuna kitabu kilichopatikana kwa “${searchQuery.trim()}”. Jaribu kichwa, mwandishi, aina au lebo nyingine.`
        : `No classics match “${searchQuery.trim()}”. Try another title, author, genre, or tag.`
      : language === 'sw'
        ? 'Hakuna vitabu vya klasiki katika aina hii bado.'
        : 'No classic books are available in this category yet.';

  return (
    <section className="flex flex-col gap-7 animate-in fade-in duration-300">
      <div className="rounded-3xl border border-[#dec0b7]/35 bg-[#e7fefa]/70 px-6 py-7 sm:px-10 sm:py-9">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#a43d17]">
          {language === 'sw' ? 'Kiingereza pekee' : 'English only'}
        </p>
        <h1 className="mt-2 font-black text-3xl sm:text-4xl text-[#0a1f1d]">
          {language === 'sw' ? 'Klasiki za Kiingereza' : 'English Classics'}
        </h1>
        <p className="mt-4 max-w-none text-base sm:text-lg leading-relaxed text-[#50615e]">
          {language === 'sw' ? (
            <>
              <strong className="font-extrabold text-[#0a1f1d]">Maelfu ya vitabu bora vya dunia</strong>, vimepangwa upya kitaalamu kwa simu mahiri—aya safi, nafasi nzuri na usomaji usiochosha macho.
              <br />
              <strong className="font-extrabold text-[#a43d17]">Bure kabisa.</strong> <strong className="font-extrabold text-[#a43d17]">Pakua bila kikomo</strong>, kisha soma nje ya mtandao—nyumbani, safarini au wakati intaneti ni ghali au haipatikani.
            </>
          ) : (
            <>
              <strong className="font-extrabold text-[#0a1f1d]">Thousands of world classics</strong>, professionally reformatted for your smartphone—with cleaner paragraphs, comfortable spacing, and reading that feels easy on the eyes.
              <br />
              <strong className="font-extrabold text-[#a43d17]">100% free.</strong> <strong className="font-extrabold text-[#a43d17]">Unlimited offline downloads.</strong> Download once and read anywhere—at home, on the bus, or when data is expensive and the signal drops.
            </>
          )}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <figure className="overflow-hidden rounded-3xl border border-[#dec0b7]/35 bg-white/75 shadow-sm">
          <img
            src="/classics/reader-comparison-tale-of-two-cities.webp"
            alt={language === 'sw' ? 'Kitabu cha asili na toleo la Soma la A Tale of Two Cities' : 'Original book and Soma edition comparison for A Tale of Two Cities'}
            loading="lazy"
            decoding="async"
            width="640"
            height="360"
            className="aspect-video w-full object-cover"
          />
          <figcaption className="px-5 py-4">
            <h2 className="font-extrabold text-base text-[#0a1f1d]">
              {language === 'sw' ? 'A Tale of Two Cities · Asili dhidi ya Soma' : 'A Tale of Two Cities · Original vs Soma'}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-[#657571]">
              {language === 'sw'
                ? 'Skrini mbili ziko pamoja ili tofauti ya aya ndefu na aya fupi ionekane mara moja.'
                : 'The two screens sit side by side so the paragraph and spacing changes are immediately visible.'}
            </p>
          </figcaption>
        </figure>

        <figure className="overflow-hidden rounded-3xl border border-[#b8dcd5] bg-[#f5fffc] shadow-sm">
          <img
            src="/classics/reader-comparison-war-of-the-worlds.webp"
            alt={language === 'sw' ? 'Kitabu cha asili na toleo la Soma la The War of the Worlds' : 'Original book and Soma edition comparison for The War of the Worlds'}
            loading="lazy"
            decoding="async"
            width="640"
            height="360"
            className="aspect-video w-full object-cover"
          />
          <figcaption className="px-5 py-4">
            <h2 className="font-extrabold text-base text-[#0a1f1d]">
              {language === 'sw' ? 'The War of the Worlds · Asili dhidi ya Soma' : 'The War of the Worlds · Original vs Soma'}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-[#657571]">
              {language === 'sw'
                ? 'Mfano wa pili unaonyesha jinsi maelezo mazito yanavyoweza kubadilishwa kuwa usomaji mwepesi wa simu.'
                : 'A second example shows dense description transformed into a lighter, phone-friendly reading rhythm.'}
            </p>
          </figcaption>
        </figure>
      </div>

      <div className="rounded-3xl border border-[#dec0b7]/35 bg-white/75 p-4 sm:p-5 shadow-sm">
        <label htmlFor="classic-library-search" className="mb-2 block text-sm font-extrabold text-[#0a1f1d]">
          {language === 'sw' ? 'Tafuta katika Klasiki za Kiingereza' : 'Search English Classics'}
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#6E7E7A]" aria-hidden="true" />
          <input
            id="classic-library-search"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setSearchQuery('');
            }}
            placeholder={language === 'sw'
              ? 'Tafuta kwa kichwa, mwandishi, aina au lebo…'
              : 'Search by title, author, genre, or tag…'}
            aria-describedby="classic-search-status"
            className="h-12 w-full rounded-2xl border border-[#dec0b7]/45 bg-[#f8f7f2] pl-12 pr-12 text-base font-medium text-[#0a1f1d] outline-none transition focus:border-[#a43d17] focus:ring-4 focus:ring-[#ed7248]/10"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label={language === 'sw' ? 'Futa utafutaji' : 'Clear search'}
              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[#6E7E7A] transition hover:bg-[#e1f8f5] hover:text-[#a43d17]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
        <p id="classic-search-status" role="status" aria-live="polite" className="mt-2 text-xs font-semibold text-[#6E7E7A]">
          {normalizedQuery
            ? language === 'sw'
              ? `Matokeo ${visibleBooks.length}`
              : `${visibleBooks.length} ${visibleBooks.length === 1 ? 'result' : 'results'}`
            : language === 'sw'
              ? `${visibleBooks.length} vitabu vya klasiki`
              : `${visibleBooks.length} ${visibleBooks.length === 1 ? 'classic' : 'classics'}`}
        </p>
      </div>

      <PopularGrid
        books={visibleBooks.slice(0, visibleCount)}
        language={language}
        onSelectBook={onSelectBook}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        categories={CLASSIC_CATEGORIES}
        heading={language === 'sw' ? 'Vitabu vya Klasiki' : 'Classic Library'}
        emptyMessage={searchEmptyMessage}
      />
      {visibleBooks.length > visibleCount && (
        <button
          type="button"
          onClick={() => setVisibleCount((current) => current + 10)}
          className="mx-auto rounded-full border border-[#a43d17]/30 bg-white px-7 py-3 text-sm font-extrabold text-[#a43d17] shadow-sm transition hover:bg-[#fff7f2]"
        >
          {language === 'sw'
            ? `Onyesha zaidi · ${visibleBooks.length - visibleCount} vimesalia`
            : `Show more · ${visibleBooks.length - visibleCount} remaining`}
        </button>
      )}
    </section>
  );
};
