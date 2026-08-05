import Link from "next/link";
import { notFound } from "next/navigation";
import { findPublishedBook, listPublishedChapters } from "@/app/lib/content-repository";
import { ReaderShell } from "@/app/components/reader-shell";
import { T } from "@/app/components/language-provider";

export default async function ReadPage({ params }: { params: Promise<{ bookSlug: string; chapterNumber: string }> }) {
  const { bookSlug, chapterNumber } = await params;
  const number = Number(chapterNumber);
  if (!Number.isInteger(number) || number < 1) notFound();
  const [book, list] = await Promise.all([findPublishedBook(bookSlug), listPublishedChapters(bookSlug)]);
  const chapter = list.find((item) => item.number === number);
  if (!book || !chapter) notFound();
  const previous = list.find((item) => item.number === number - 1);
  const next = list.find((item) => item.number === number + 1);
  return <ReaderShell bookSlug={book.slug} chapterNumber={number} bookId={book.id} chapterId={chapter.id} chapters={list.map((item) => ({ id: item.id, number: item.number, title: item.title, content: item.paragraphs.join("\n\n") }))}><div className="reader-top"><Link href={`/book/${book.slug}`}>← <T id="back" /></Link><Link href={`/book/${book.slug}`} className="reader-title">{book.title}</Link><span /></div><main className="reader-main"><div className="offline-note">✓ <T id="offlineSaved" /></div><span className="reader-chapter-label"><T id="chapter" values={{ number: String(chapter.number).padStart(2, "0") }} /></span><h1>{chapter.title}</h1><article className="reader-body">{chapter.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</article><div className="reader-footer">{previous ? <Link href={`/read/${book.slug}/${previous.number}`}>← <T id="previous" /></Link> : <span />}{next ? <Link href={`/read/${book.slug}/${next.number}`}><T id="nextChapter" /> →</Link> : <Link href={`/book/${book.slug}`}><T id="backBook" /> →</Link>}</div></main></ReaderShell>;
}
