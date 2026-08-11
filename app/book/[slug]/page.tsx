import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BottomNav, SiteHeader } from "@/app/components/site-header";
import { BookCover } from "@/app/components/book-cover";
import { findPublishedBook, listPublishedBookVersions, listPublishedChapters } from "@/app/lib/content-repository";
import { BookActions } from "@/app/components/book-actions";
import { BookViewTracker } from "@/app/components/book-view-tracker";
import { T } from "@/app/components/language-provider";
import { SiteFooter } from "@/app/components/site-footer";

type BookPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: BookPageProps): Promise<Metadata> {
  const { slug } = await params;
  const book = await findPublishedBook(slug);
  if (!book) return { title: "Book not found", robots: { index: false, follow: false } };
  const canonical = `/book/${encodeURIComponent(book.slug)}`;
  return {
    title: book.title,
    description: book.description,
    alternates: { canonical },
    openGraph: {
      type: "book",
      title: book.title,
      description: book.description,
      url: canonical,
      images: book.coverUrl ? [{ url: book.coverUrl, alt: `Cover of ${book.title}` }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: book.title,
      description: book.description,
      images: book.coverUrl ? [book.coverUrl] : undefined,
    },
  };
}

export default async function BookPage({ params }: BookPageProps) {
  const { slug } = await params;
  const book = await findPublishedBook(slug);
  if (!book) notFound();
  const [bookChapters, versions] = await Promise.all([listPublishedChapters(slug), listPublishedBookVersions(book)]);
  const firstChapter = bookChapters[0];
  return <div className="site-page"><BookViewTracker bookId={book.id} /><SiteHeader /><main className="shell detail-main"><Link href="/discover" className="back-link">← <span><T id="backDiscover" /></span></Link><section className="detail-hero"><BookCover book={book} size="large" /><div className="detail-copy"><span className="pill pill-orange">{book.languageLabel} · {book.categoryLabel}</span><h1>{book.title}</h1><p className="author">By {book.author}</p><p className="description">{book.description}</p>{versions.length > 1 && <nav className="book-version-switcher" aria-label="Book language versions">{versions.map((version) => version.slug === book.slug ? <span className="book-version-current" key={version.slug}>{version.languageLabel}</span> : <Link key={version.slug} href={`/book/${version.slug}`}>{version.languageLabel}</Link>)}</nav>}<div className="detail-meta"><span><T id="chapters" values={{ count: book.chapters }} /></span><span><T id="updated" values={{ time: book.updated }} /></span><span><T id="freeToRead" /></span></div><div className="button-row">{firstChapter && <Link href={`/read/${book.slug}/${firstChapter.number}`} className="button button-primary"><T id="startReading" /> <span>→</span></Link>}<BookActions bookId={book.id} /></div></div></section><section className="chapter-section"><p className="eyebrow"><T id="theStory" /></p><h2><T id="chapters" values={{ count: "" }} /></h2><div className="chapter-list">{bookChapters.map((chapter) => <Link className="chapter-row" href={`/read/${book.slug}/${chapter.number}`} key={chapter.number}><span className="chapter-no">{String(chapter.number).padStart(2, "0")}</span><span className="chapter-info"><span className="chapter-title">{chapter.title}</span><span className="chapter-summary">{chapter.summary}</span></span><span className="chapter-arrow">→</span></Link>)}{book.chapters > bookChapters.length && <div className="chapter-row"><span className="chapter-no">…</span><span className="chapter-info"><span className="chapter-title"><T id="moreChapters" /></span><span className="chapter-summary"><T id="followStory" /></span></span></div>}</div></section></main><SiteFooter /><BottomNav /></div>;
}
