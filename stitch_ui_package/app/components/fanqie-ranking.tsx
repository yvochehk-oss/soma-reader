import Link from "next/link";
import { BookCover } from "@/app/components/book-cover";
import { T } from "@/app/components/language-provider";
import type { Book } from "@/app/lib/content-repository";

export function FanqieRanking({ books }: { books: Book[] }) {
  if (!books.length) return null;

  return (
    <div className="fanqie-ranking-board">
      <div className="section-heading">
        <div>
          <p className="eyebrow">TOP RANKINGS</p>
          <h2>🔥 <T id="topRankings" /></h2>
        </div>
        <Link href="/discover?tab=ranking" className="text-link">
          <T id="seeAll" /> <span>→</span>
        </Link>
      </div>

      <div className="ranking-grid">
        {books.slice(0, 3).map((book, index) => {
          const rank = index + 1;
          const heatCount = Math.floor(85 + (3 - index) * 42.5);

          return (
            <Link key={book.slug} href={`/book/${book.slug}`} className={`fanqie-rank-card rank-${rank}`}>
              <div className="rank-badge-wrap">
                <span className={`rank-badge rank-badge-${rank}`}>
                  {rank === 1 ? "🥇 1" : rank === 2 ? "🥈 2" : "🥉 3"}
                </span>
                <span className="rank-heat">🔥 {heatCount}k</span>
              </div>
              <div className="rank-cover">
                <BookCover book={book} size="medium" />
              </div>
              <div className="rank-info">
                <span className="pill pill-orange">{book.badge || "Hot"}</span>
                <h3 className="rank-title">{book.title}</h3>
                <p className="rank-desc">{book.description}</p>
                <div className="rank-meta">
                  <span className="author"><T id="by" /> {book.author}</span>
                  <span className="chapters"><T id="chapters" values={{ count: book.chapters }} /></span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
