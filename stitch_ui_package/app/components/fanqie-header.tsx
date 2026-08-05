"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LanguageSwitcher, T, useTranslation } from "@/app/components/language-provider";

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

  const handleTagClick = (tag: string) => {
    router.push(`/discover?q=${encodeURIComponent(tag)}`);
  };

  return (
    <header className="fanqie-header-wrapper">
      {/* Top Navbar */}
      <div className="fanqie-top-bar">
        <div className="shell fanqie-header-inner">
          <Link href="/" className="brand" aria-label="Soma reader home">
            <span className="brand-mark">S</span>
            <span className="brand-title">Soma<small className="brand-tag">番茄阅读</small></span>
          </Link>

          {/* Search Box */}
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

          {/* Actions & Language */}
          <div className="header-actions">
            <nav className="header-nav">
              <Link href="/discover">{t("discover")}</Link>
              <Link href="/library">{t("shelf")}</Link>
              <Link href="/login" className="header-login">{t("signIn")}</Link>
            </nav>
            <LanguageSwitcher />
          </div>
        </div>
      </div>

      {/* Quick Hot Keyword Tags & Channels Bar */}
      <div className="fanqie-sub-nav">
        <div className="shell fanqie-sub-inner">
          <div className="fanqie-channel-tabs">
            <Link href="/" className="channel-tab active">{t("home")}</Link>
            <Link href="/discover?category=romance" className="channel-tab">{t("romance")}</Link>
            <Link href="/discover?category=thriller" className="channel-tab">{t("thriller")}</Link>
            <Link href="/discover?tab=ranking" className="channel-tab">{t("topRankings")}</Link>
            <Link href="/discover?tab=completed" className="channel-tab">{t("completedZone")}</Link>
          </div>
          <div className="fanqie-hot-tags">
            <span className="hot-label">🔥 {t("popularNow")}:</span>
            <button onClick={() => handleTagClick("Billionaire")}>#{t("searchHotKey1")}</button>
            <button onClick={() => handleTagClick("Romance")}>#{t("searchHotKey2")}</button>
            <button onClick={() => handleTagClick("Sun Queen")}>#{t("searchHotKey3")}</button>
          </div>
        </div>
      </div>
    </header>
  );
}
