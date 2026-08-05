import Link from "next/link";
import { AnalyticsCards } from "@/app/components/analytics-cards";
import { T } from "@/app/components/language-provider";

export const metadata = { title: "Studio" };

export default function AdminOverviewPage() {
  return <main className="shell admin-main"><div className="admin-title-row"><div><p className="eyebrow">Soma</p><h1><T id="overview" /></h1></div><Link href="/admin/books/new" className="button button-primary">＋ <T id="newBook" /></Link></div><AnalyticsCards overview /><div className="admin-columns"><section className="admin-panel"><div className="admin-panel-heading"><div><p className="eyebrow"><T id="content" /></p><h2><T id="latestBooks" /></h2></div><Link href="/admin/books" className="text-link"><T id="manageAll" /> →</Link></div><div className="admin-empty"><span className="admin-empty-icon">＋</span><h3><T id="addBook" /></h3><p>Upload a book and its chapters from TXT, Markdown or JSON.</p><Link href="/admin/books/new" className="button button-secondary"><T id="addBook" /></Link></div></section><section className="admin-panel"><div className="admin-panel-heading"><div><p className="eyebrow"><T id="coreFunnel" /></p><h2><T id="readerJourney" /></h2></div><Link href="/admin/analytics" className="text-link"><T id="viewData" /> →</Link></div><div className="funnel"><div><span><T id="bookDetail" /></span><strong>—</strong></div><div><span><T id="chapter1Start" /></span><strong>—</strong></div><div><span><T id="chapter3Finish" /></span><strong>—</strong></div><div><span><T id="nextDayReturn" /></span><strong>—</strong></div></div></section></div></main>;
}
