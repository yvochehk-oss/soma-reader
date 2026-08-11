import { BottomNav, SiteHeader } from "@/app/components/site-header";
import { BookCard } from "@/app/components/book-card";
import { listPublishedBooks } from "@/app/lib/content-repository";
import { T } from "@/app/components/language-provider";
import { getContentLocale } from "@/app/lib/content-locale";
import { SiteFooter } from "@/app/components/site-footer";

export const metadata = { title: "Discover" };
export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const books = await listPublishedBooks(await getContentLocale());
  return <div className="site-page"><SiteHeader /><main className="shell page-main"><div className="page-heading"><div><p className="eyebrow"><T id="closeStory" /></p><h1><T id="discover" /></h1></div><span className="book-card-meta"><T id="stories" values={{ count: books.length }} /></span></div><div className="filters"><span className="filter filter-active"><T id="allStories" /></span><span className="filter"><T id="english" /></span><span className="filter"><T id="kiswahili" /></span><span className="filter"><T id="romance" /></span><span className="filter"><T id="thriller" /></span><span className="filter"><T id="life" /></span></div><div className="discover-grid">{books.map((book) => <BookCard key={book.slug} book={book} />)}</div></main><SiteFooter /><BottomNav active="discover" /></div>;
}
