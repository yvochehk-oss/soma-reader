import Link from "next/link";
import { BottomNav, SiteHeader } from "@/app/components/site-header";
import { OfflineLibrary } from "@/app/components/offline-library";
import { T } from "@/app/components/language-provider";
import { SiteFooter } from "@/app/components/site-footer";

export const metadata = { title: "Offline reading" };

export default function OfflinePage() {
  return <div className="site-page"><SiteHeader /><main className="shell page-main"><Link href="/library" className="back-link">← <span><T id="shelf" /></span></Link><div className="page-heading"><div><p className="eyebrow"><T id="offlineText" /></p><h1><T id="offlineTitle" /></h1></div></div><OfflineLibrary /></main><SiteFooter /><BottomNav active="library" /></div>;
}
