import Link from "next/link";
import { LanguageSwitcher, T } from "@/app/components/language-provider";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link href="/" className="brand" aria-label="Soma home">
          <span className="brand-mark">S</span>
          <span>Soma</span>
        </Link>
        <div className="header-actions"><nav className="header-nav" aria-label="Main navigation">
          <Link href="/discover"><T id="discover" /></Link>
          <Link href="/library"><T id="shelf" /></Link>
          <Link href="/login" className="header-login"><T id="signIn" /></Link>
        </nav><LanguageSwitcher /></div>
      </div>
    </header>
  );
}

export function BottomNav({ active = "home" }: { active?: "home" | "discover" | "library" }) {
  return (
    <nav className="bottom-nav" aria-label="Mobile navigation">
      <Link href="/" className={active === "home" ? "active" : ""}><span>⌂</span><T id="home" /></Link>
      <Link href="/discover" className={active === "discover" ? "active" : ""}><span>⌕</span><T id="discover" /></Link>
      <Link href="/library" className={active === "library" ? "active" : ""}><span>▣</span><T id="shelf" /></Link>
      <Link href="/login"><span>○</span><T id="signIn" /></Link>
    </nav>
  );
}
