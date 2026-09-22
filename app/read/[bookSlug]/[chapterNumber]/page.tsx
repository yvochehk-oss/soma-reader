import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findPublishedBook, listPublishedChapters } from "@/app/lib/content-repository";
import { ReaderShell } from "@/app/components/reader-shell";
import { GoogleAdSenseUnit } from "@/app/components/google-adsense-unit";
import { T } from "@/app/components/language-provider";
import { getSiteUrl } from "@/app/lib/site";
import { ADSENSE_PUBLISHER_ID } from "@/app/lib/adsense";

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
    other: {
      "google-adsense-account": ADSENSE_PUBLISHER_ID,
      "google-adsense-platform-account": ADSENSE_PUBLISHER_ID,
      "google-adsense-platform-domain": "somanovel.uk",
    },
    openGraph: {
      type: "article",
      title: `${book.title} — ${chapter.title}`,
      description,
      url: canonical,
      images: book.coverUrl ? [{ url: book.coverUrl, alt: `Cover of ${book.title}` }] : undefined },
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
  const origin = getSiteUrl();
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${origin}/read/${book.slug}/${chapter.number}`,
    headline: `${book.title} — Chapter ${chapter.number}: ${chapter.title}`,
    description: chapter.paragraphs.join(" ").slice(0, 320),
    inLanguage: book.language === "sw" ? "sw" : "en",
    isPartOf: {
      "@type": "Book",
      "@id": `${origin}/books/${book.slug}/`,
      name: book.title,
      author: { "@type": "Person", name: book.author },
      inLanguage: book.language === "sw" ? "sw" : "en",
    },
    author: { "@type": "Person", name: book.author },
    publisher: {
      "@type": "Organization",
      name: "Soma Novel",
      alternateName: "Soma Novel — Free bilingual web novels, re-typeset English classics & self-publishing",
      url: origin,
      description: "Soma Novel publishes two catalogue sections: (1) original web fiction side-by-side in English and Kiswahili, free to read and free to download; (2) more than a thousand re-typeset English public-domain classics for phone reading, English only, free to read and free to download. It also offers a free self-publishing uploader that accepts .txt and .epub in either English or Kiswahili. / Soma Novel inachapisha sehemu mbili za orodha: (1) riwaya za mtandaoni za asili kwa Kiingereza na Kiswahili kwa pamoja, bure kusoma na kupakua; (2) zaidi ya vitabu elfu moja vya kale vya Kiingereza vilivyopangwa upya kwa ajili ya kusoma kwenye simu, Kiingereza pekee, bure kusoma na kupakua. Pia inatoa kifungu cha bure cha kuchapisha mwenyewe kinachokubali .txt na .epub kwa Kiingereza au Kiswahili.",
    },
    url: `${origin}/read/${book.slug}/${chapter.number}`,
    mainEntityOfPage: { "@type": "WebPage", "@id": `${origin}/read/${book.slug}/${chapter.number}` },
    position: chapter.number,
    wordCount: chapter.paragraphs.reduce((sum, paragraph) => sum + paragraph.split(/\s+/).filter(Boolean).length, 0),
  };
  return (<>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd).replaceAll("<", "\\u003c") }} />
    <ReaderShell bookSlug={book.slug} chapterNumber={number} bookId={book.id} chapterId={chapter.id} chapters={list.map((item) => ({ id: item.id, number: item.number, title: item.title, content: item.paragraphs.join("\n\n") }))}><div className="reader-top"><Link href={`/book/${book.slug}`}>← <T id="back" /></Link><Link href={`/book/${book.slug}`} className="reader-title">{book.title}</Link><span /></div><main className="reader-main"><div className="offline-note">✓ <T id="offlineSaved" /></div><span className="reader-chapter-label"><T id="chapter" values={{ number: String(chapter.number).padStart(2, "0") }} /></span><h1>{chapter.title}</h1><article className="reader-body">{chapter.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</article><GoogleAdSenseUnit key={`${book.slug}:${number}`} /><div className="reader-footer">{previous ? <Link href={`/read/${book.slug}/${previous.number}`}>← <T id="previous" /></Link> : <span />}{next ? <Link href={`/read/${book.slug}/${next.number}`}><T id="nextChapter" /> →</Link> : <Link href={`/book/${book.slug}`}><T id="backBook" /> →</Link>}</div></main></ReaderShell>
  </>);
}
