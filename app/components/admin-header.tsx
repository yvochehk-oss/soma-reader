import Link from "next/link";
import { T, LanguageSwitcher } from "@/app/components/language-provider";

export function AdminHeader() {
  return <header className="admin-header"><div className="shell admin-header-inner"><Link href="/admin" className="brand"><span className="brand-mark">S</span><span>Soma <T id="studio" /></span></Link><nav className="admin-nav"><Link href="/admin"><T id="overview" /></Link><Link href="/admin/books"><T id="books" /></Link><Link href="/admin/import">Import</Link><Link href="/admin/analytics"><T id="analytics" /></Link><LanguageSwitcher /><Link href="/" className="admin-view-link">View site ↗</Link></nav></div></header>;
}
