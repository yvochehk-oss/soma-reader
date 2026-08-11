import type { ReactNode } from "react";
import { BottomNav, SiteHeader } from "@/app/components/site-header";
import { SiteFooter } from "@/app/components/site-footer";

export function LegalPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <div className="site-page legal-site-page">
      <SiteHeader />
      <main className="shell legal-main">
        <article className="legal-card">
          <p className="eyebrow">Soma Novel</p>
          <h1>{title}</h1>
          <p className="legal-intro">{intro}</p>
          {children}
        </article>
      </main>
      <SiteFooter />
      <BottomNav />
    </div>
  );
}
