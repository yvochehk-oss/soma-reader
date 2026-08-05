import Link from "next/link";
import { notFound } from "next/navigation";
import { findAdminBook, listAdminChapters } from "@/app/lib/admin-repository";
import { ChapterImporter } from "@/app/components/chapter-importer";
import { T } from "@/app/components/language-provider";

export default async function AdminChaptersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [book, chapters] = await Promise.all([findAdminBook(id), listAdminChapters(id)]);
  if (!book) notFound();
  return <main className="shell admin-main"><Link href={`/admin/books/${id}`} className="back-link">← <span><T id="book" /></span></Link><div className="admin-title-row"><div><p className="eyebrow"><T id="chapterManager" /></p><h1>{book.title}</h1><p className="admin-subtitle">{chapters.length} chapters · Import up to 100 chapters at once</p></div></div><ChapterImporter bookId={book.id} /><div className="chapter-admin-list">{chapters.map((chapter) => <div className="chapter-admin-row" key={chapter.id}><span className="chapter-no">{String(chapter.chapter_number).padStart(2, "0")}</span><div><strong>{chapter.title}</strong><small>{chapter.word_count} words</small></div><span className={chapter.status === "published" ? "status-published" : "status-draft"}>{chapter.status}</span></div>)}{!chapters.length && <div className="admin-empty"><p>No chapters yet. Import a TXT, Markdown or JSON file.</p></div>}</div></main>;
}
