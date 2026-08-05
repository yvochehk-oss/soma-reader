import Link from "next/link";
import { AdminBookForm } from "@/app/components/admin-book-form";
import { T } from "@/app/components/language-provider";

export const metadata = { title: "New book" };

export default function NewBookPage() {
  return <main className="shell admin-main"><Link href="/admin/books" className="back-link">← <span><T id="books" /></span></Link><div className="admin-form-heading"><p className="eyebrow"><T id="contentLibrary" /></p><h1><T id="addBook" /></h1><p><T id="createBookText" /></p></div><AdminBookForm /></main>;
}
