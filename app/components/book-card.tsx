import Link from "next/link";
import type { Book } from "@/app/lib/demo-data";
import { BookCover } from "@/app/components/book-cover";
import { T } from "@/app/components/language-provider";

export function BookCard({ book, compact = false }: { book: Book; compact?: boolean }) {
  return (
    <Link href={`/books/${book.slug}/`} className={`book-card ${compact ? "book-card-compact" : ""}`}>
      <BookCover book={book} size={compact ? "small" : "medium"} />
      <span className="book-card-copy">
        <span className="book-card-title">{book.title}</span>
        <span className="book-card-author">{book.author}</span>
        <span className="book-card-meta">{book.language === "sw" ? <T id="kiswahili" /> : <T id="english" />} · <T id="chapters" values={{ count: book.chaptersCount }} /></span>
      </span>
    </Link>
  );
}