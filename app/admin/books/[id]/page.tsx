import Link from "next/link";
import { notFound } from "next/navigation";
import { findAdminBook } from "@/app/lib/admin-repository";
import { AdminBookForm } from "@/app/components/admin-book-form";
import { PublishBookButton } from "@/app/components/publish-book-button";
import { T } from "@/app/components/language-provider";

export default async function AdminBookEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const book = await findAdminBook(id);
  if (!book) notFound();
  return <main className="shell admin-main"><Link href="/admin/books" className="back-link">← <span><T id="books" /></span></Link><div className="admin-title-row"><div><p className="eyebrow"><T id="edit" /> <T id="book" /></p><h1>{book.title}</h1><p className="admin-subtitle">{book.status}</p></div><div className="button-row"><Link href={`/admin/books/${id}/chapters`} className="button button-secondary"><T id="manageChapters" /></Link><PublishBookButton id={book.id} status={book.status} /></div></div><AdminBookForm existing={book} /><Link href={`/book/${book.slug}`} className="text-link"><T id="preview" /> ↗</Link></main>;
}
