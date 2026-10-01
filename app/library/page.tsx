import { BottomNav, SiteHeader } from "@/app/components/site-header";
import { listPublishedBooks } from "@/app/lib/content-repository";
import Link from "next/link";
import { LibraryShelf } from "@/app/components/library-shelf";import { GoogleAdSenseUnit } from "@/app/components/google-adsense-unit";
import { SiteFooter } from "@/app/components/site-footer";
import { T } from "@/app/components/language-provider";
import { getContentLocale } from "@/app/lib/content-locale";

export const metadata = { title: "My shelf" };
export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const books = await listPublishedBooks(await getContentLocale());
  return <div className="site-page"><SiteHeader /><main className="shell page-main"><div className="page-heading"><div><p className="eyebrow"><T id="yourStories" /></p><h1><T id="shelf" /></h1></div><Link href="/offline" className="text-link"><T id="offlineStories" /> <span>→</span></Link></div><LibraryShelf books={books} /><GoogleAdSenseUnit /></main><SiteFooter /><BottomNav active="library" /></div>;
}
