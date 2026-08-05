import Link from "next/link";
import { listAdminBooks } from "@/app/lib/admin-repository";
import { T } from "@/app/components/language-provider";
import { BookBatchImporter } from "@/app/components/book-batch-importer";
import { ClearBookLibraryButton } from "@/app/components/clear-book-library-button";
import { requireEditor } from "@/app/lib/admin-access";

export const metadata = { title: "Books" };

export default async function AdminBooksPage() {
  const [books, access] = await Promise.all([listAdminBooks(), requireEditor()]);
  return <main className="shell admin-main"><div className="admin-title-row"><div><p className="eyebrow"><T id="contentLibrary" /></p><h1><T id="books" /></h1></div><div className="admin-title-actions">{access.role === "admin" && <ClearBookLibraryButton count={books.length} />}<Link href="/admin/books/new" className="button button-primary">＋ <T id="newBook" /></Link></div></div><BookBatchImporter /><div className="admin-toolbar"><span className="filter filter-active"><T id="all" /></span><span className="filter"><T id="published" /></span><span className="filter"><T id="drafts" /></span><span className="filter"><T id="kiswahili" /></span><input className="admin-search" placeholder="Search books" /></div><div className="book-table"><div className="book-table-head"><span><T id="book" /></span><span><T id="language" /></span><span><T id="chapters" values={{ count: "" }} /></span><span><T id="status" /></span><span /></div>{books.map((book) => <div className="book-table-row" key={book.id}><div><strong>{book.title}</strong><small>{book.author_name}</small></div><span>{book.language_code === "sw" ? <T id="kiswahili" /> : <T id="english" />}</span><span>{book.total_chapters}</span><span className={book.status === "published" ? "status-published" : "status-draft"}>{book.status}</span><Link href={`/admin/books/${book.id}`}><T id="edit" /> →</Link></div>)}{!books.length && <div className="admin-empty"><h3><T id="addBook" /></h3><Link href="/admin/books/new" className="button button-secondary"><T id="newBook" /></Link></div>}</div></main>;
}
