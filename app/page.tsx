import Link from "next/link";
import { BottomNav } from "@/app/components/site-header";
import { FanqieHeader } from "@/app/components/fanqie-header";
import { FanqieRanking } from "@/app/components/fanqie-ranking";
import { BookCard } from "@/app/components/book-card";
import { BookCover } from "@/app/components/book-cover";
import { listPublishedBooks, type Book } from "@/app/lib/content-repository";
import { T } from "@/app/components/language-provider";
import { getContentLocale } from "@/app/lib/content-locale";
import { SiteFooter } from "@/app/components/site-footer";

export const dynamic = "force-dynamic";

export default async function Home() {
  const fetchedBooks = await listPublishedBooks(await getContentLocale());

  const fallbackBooks: Book[] = [
    {
      id: "demo-1",
      slug: "the-billionaire-s-rejected-bride-rise-of-the-sun-queen",
      title: "The Billionaire's Rejected Bride: Rise of the Sun Queen",
      author: "Soma Originals",
      language: "en" as const,
      languageLabel: "English",
      category: "romance",
      categoryLabel: "Romance",
      description: "Rejected by the powerful billionaire, she rises from betrayal to claim her true crown as the Sun Queen of East Africa.",
      coverUrl: null,
      badge: "9.8 Score",
      chapters: 10,
      updated: "Just now",
      accent: "orange",
    },
    {
      id: "demo-2",
      slug: "malkia-wa-jua-kiswahili",
      title: "Malkia wa Jua: Kuinuka kwa Bibi Harusi Aliyeataliwa",
      author: "Soma Originals",
      language: "sw" as const,
      languageLabel: "Kiswahili",
      category: "romance",
      categoryLabel: "Mapenzi",
      description: "Hadithi ya kusisimua ya mapenzi, usaliti na ushindi katika mji mkuu wa Nairobi.",
      coverUrl: null,
      badge: "🔥 Hot",
      chapters: 10,
      updated: "Leo",
      accent: "teal",
    },
    {
      id: "demo-3",
      slug: "nights-of-nairobi",
      title: "Nights of Nairobi: Shadows & Secrets",
      author: "Kileleshwa Writer",
      language: "en" as const,
      languageLabel: "English",
      category: "thriller",
      categoryLabel: "Thriller",
      description: "A dark mystery unravels beneath the vibrant neon lights of Westlands.",
      coverUrl: null,
      badge: "Thriller",
      chapters: 15,
      updated: "Yesterday",
      accent: "purple",
    },
  ];

  const books = fetchedBooks.length > 0 ? fetchedBooks : fallbackBooks;
  const featured = books[0];

  return (
    <div className="site-page">
      <FanqieHeader />

      <main className="shell home-main">
        {/* 1. Quick Diamond Shortcuts */}
        <section className="fanqie-quick-grid">
          <Link href="/discover?tab=ranking" className="fanqie-quick-item">
            <span className="quick-icon bg-orange-grad">🔥</span>
            <span className="quick-title"><T id="topRankings" /></span>
          </Link>
          <Link href="/discover?tab=latest" className="fanqie-quick-item">
            <span className="quick-icon bg-teal-grad">⚡️</span>
            <span className="quick-title"><T id="justAdded" /></span>
          </Link>
          <Link href="/discover?tab=free" className="fanqie-quick-item">
            <span className="quick-icon bg-purple-grad">🎁</span>
            <span className="quick-title"><T id="freeZone" /></span>
          </Link>
          <Link href="/discover?tab=completed" className="fanqie-quick-item">
            <span className="quick-icon bg-green-grad">🏆</span>
            <span className="quick-title"><T id="completedZone" /></span>
          </Link>
          <Link href="/discover?tab=bilingual" className="fanqie-quick-item">
            <span className="quick-icon bg-amber-grad">🌐</span>
            <span className="quick-title"><T id="bilingualZone" /></span>
          </Link>
        </section>

        {/* 2. Heavyweight Hero Section */}
        <section className="section-block hero-banner-block">
          <div className="section-heading">
            <div>
              <p className="eyebrow">👑 <T id="editorChoice" /></p>
              <h2><T id="featuredWeek" /></h2>
            </div>
            <Link href="/discover" className="text-link">
              <T id="seeAll" /> <span>→</span>
            </Link>
          </div>

          <div className="featured-card">
            <div className="featured-cover">
              <BookCover book={featured} size="large" />
            </div>
            <div className="featured-copy">
              <span className="pill pill-orange">{featured.badge || "Featured"}</span>
              <h3>{featured.title}</h3>
              <p>{featured.description}</p>
              <span className="book-card-author"><T id="by" /> {featured.author}</span>
              <div className="hero-action-buttons">
                <Link href={`/read/${featured.slug}/1`} className="button button-primary">
                  <T id="readNow" /> <span>→</span>
                </Link>
                <Link href={`/book/${featured.slug}`} className="button button-secondary">
                  <T id="theStory" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Top Ranking Section */}
        <FanqieRanking books={books} />

        {/* 4. Language Selection Banner */}
        <section className="language-banner">
          <div>
            <p className="eyebrow"><T id="readYourWay" /></p>
            <h2><T id="storiesLanguages" /></h2>
          </div>
          <div className="language-words">
            <span>Hello</span>
            <span>Karibu</span>
            <span>Read</span>
            <span>Soma</span>
          </div>
          <div className="home-language-actions">
            <Link href="/discover?language=en"><T id="english" /></Link>
            <Link href="/discover?language=sw"><T id="kiswahili" /></Link>
          </div>
        </section>

        {/* 5. Recommended Novels Grid */}
        <section className="section-block latest-block">
          <div className="section-heading">
            <div>
              <p className="eyebrow"><T id="recommendForYou" /></p>
              <h2><T id="popularNow" /></h2>
            </div>
            <Link href="/discover" className="text-link">
              <T id="seeAll" /> <span>→</span>
            </Link>
          </div>

          <div className="book-grid">
            {books.map((book) => (
              <BookCard key={book.slug} book={book} />
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
      <BottomNav active="home" />
    </div>
  );
}
