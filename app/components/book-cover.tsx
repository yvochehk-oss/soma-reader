import type { Book } from "@/app/lib/demo-data";

const accentClasses = {
  orange: "cover-orange",
  teal: "cover-teal",
  purple: "cover-purple",
  green: "cover-green",
};

export function BookCover({ book, size = "medium" }: { book: Book; size?: "small" | "medium" | "large" }) {
  if (book.coverImage) {
    return <div className={`book-cover book-cover-image book-cover-${size}`} aria-label={`${book.title} cover`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={book.coverImage} alt={`${book.title} cover`} />
    </div>;
  }
  return (
    <div className={`book-cover ${accentClasses[book.accent]} book-cover-${size}`} aria-label={`${book.title} cover`}>
      <span className="cover-kicker">TALES FROM KENYA</span>
      <strong>{book.title}</strong>
      <span className="cover-author">{book.author}</span>
      <span className="cover-sun" aria-hidden="true" />
    </div>
  );
}