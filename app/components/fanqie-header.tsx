"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LanguageSwitcher, useTranslation } from "@/app/components/language-provider";

export function FanqieHeader() {
  const { t } = useTranslation();
  const router = useRouter();
  const [query, setQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/discover?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <header className="fanqie-header-wrapper">
      <div className="fanqie-top-bar">
        <div className="shell fanqie-header-inner">
          <Link href="/" className="brand" aria-label="Soma home">
            <span className="brand-mark">S</span>
            <span className="brand-title">Soma<small className="brand-tag">Reader</small></span>
          </Link>

          <form className="fanqie-search-box" onSubmit={handleSearch}>
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder={t("searchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit" className="search-btn">
              {t("discover")}
            </button>
          </form>

          <div className="header-actions">
            <nav className="header-nav" aria-label="Main navigation">
              <Link href="/">{t("home")}</Link>
              <Link href="/discover?category=romance">{t("romance")}</Link>
              <Link href="/discover?category=thriller">{t("thriller")}</Link>
              <Link href="/library">{t("shelf")}</Link>
            </nav>
            <LanguageSwitcher />
          </div>
        </div>
      </div>

      <div className="fanqie-sub-nav">
        <div className="shell fanqie-sub-inner">
          <div className="fanqie-channel-tabs">
            <Link href="/" className="channel-tab active">{t("home")}</Link>
            <Link href="/discover?category=romance" className="channel-tab">{t("romance")}</Link>
            <Link href="/discover?category=thriller" className="channel-tab">{t("thriller")}</Link>
            <Link href="/discover?tab=ranking" className="channel-tab">{t("topRankings")}</Link>
            <Link href="/discover?tab=completed" className="channel-tab">{t("completedZone")}</Link>
          </div>
        </div>
      </div>
    </header>
  );
}
