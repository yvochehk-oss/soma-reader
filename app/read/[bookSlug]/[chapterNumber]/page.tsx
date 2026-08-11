import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findPublishedBook, listPublishedChapters } from "@/app/lib/content-repository";
import { ReaderShell } from "@/app/components/reader-shell";
import { GoogleAdSenseUnit } from "@/app/components/google-adsense-unit";
import { T } from "@/app/components/language-provider";

type ReadPageProps = { params: Promise<{ bookSlug: string; chapterNumber: string }> };

export async function generateMetadata({ params }: ReadPageProps): Promise<Metadata> {
  const { bookSlug, chapterNumber } = await params;
  const number = Number(chapterNumber);
  if (!Number.isInteger(number) || number < 1) return { title: "Chapter not found", robots: { index: false, follow: false } };
  const [book, chapters] = await Promise.all([findPublishedBook(bookSlug), listPublishedChapters(bookSlug)]);
  const chapter = chapters.find((item) => item.number === number);
  if (!book || !chapter) return { title: "Chapter not found", robots: { index: false, follow: false } };
  const canonical = `/read/${encodeURIComponent(book.slug)}/${chapter.number}`;
  const description = `Read ${chapter.title}, chapter ${chapter.number} of ${book.title} by ${book.author}, free on Soma.`;
  return {
    title: `${book.title} — Chapter ${chapter.number}: ${chapter.title}`,
    description,
    alternates: { canonical },
    openGraph: {
      type: "article",
      title: `${book.title} — ${chapter.title}`,
      description,
      url: canonical,
      images: book.coverUrl ? [{ url: book.coverUrl, alt: `Cover of ${book.title}` }] : undefined,
    },
  };
}

export default async function ReadPage({ params }: ReadPageProps) {
  const { bookSlug, chapterNumber } = await params;
  const number = Number(chapterNumber);
  if (!Number.isInteger(number) || number < 1) notFound();
  const [book, list] = await Promise.all([findPublishedBook(bookSlug), listPublishedChapters(bookSlug)]);
  const chapter = list.find((item) => item.number === number);
  if (!book || !chapter) notFound();
  const previous = list.find((item) => item.number === number - 1);
  const next = list.find((item) => item.number === number + 1);
  return <ReaderShell bookSlug={book.slug} chapterNumber={number} bookId={book.id} chapterId={chapter.id} chapters={list.map((item) => ({ id: item.id, number: item.number, title: item.title, content: item.paragraphs.join("\n\n") }))}><div className="reader-top"><Link href={`/book/${book.slug}`}>← <T id="back" /></Link><Link href={`/book/${book.slug}`} className="reader-title">{book.title}</Link><span /></div><main className="reader-main"><div className="offline-note">✓ <T id="offlineSaved" /></div><span className="reader-chapter-label"><T id="chapter" values={{ number: String(chapter.number).padStart(2, "0") }} /></span><h1>{chapter.title}</h1><article className="reader-body">{chapter.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</article><GoogleAdSenseUnit key={`${book.slug}:${number}`} /><div className="reader-footer">{previous ? <Link href={`/read/${book.slug}/${previous.number}`}>← <T id="previous" /></Link> : <span />}{next ? <Link href={`/read/${book.slug}/${next.number}`}><T id="nextChapter" /> →</Link> : <Link href={`/book/${book.slug}`}><T id="backBook" /> →</Link>}</div></main></ReaderShell>;
}
