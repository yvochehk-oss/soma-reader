import type { Metadata } from "next";
import { LegalPage } from "@/app/components/legal-page";

export const metadata: Metadata = {
  title: "About Soma Novel",
  description: "Learn about Soma Novel, a reading home for English and Kiswahili web novels from East Africa.",
};

export default function AboutPage() {
  return (
    <LegalPage title="About Soma Novel" intro="Soma Novel is a reading service for discovering and reading web novels in English and Kiswahili.">
      <section>
        <h2>What we do</h2>
        <p>We make stories easier to discover and read on phones, tablets, and computers. The catalogue focuses on English and Kiswahili fiction from East Africa, with public book pages, chapter navigation, reading preferences, and optional offline reading.</p>
        <p>Each published title has a book page with its author, description, language, chapter list, and a direct reading path. Readers can browse without an account; signing in is optional for features that synchronize a shelf or reading progress.</p>
      </section>

      <section>
        <h2>Our approach</h2>
        <p>We aim to provide a calm, accessible reading experience and to make the language and cultural context of each story clear. We continue to improve the catalogue, translations, accessibility, and reading tools as the service grows.</p>
      </section>

      <section>
        <h2>Questions about a title?</h2>
        <p>If you have a question about a book, author attribution, copyright, or a technical problem, please use our <a href="/contact">Contact page</a>.</p>
      </section>
    </LegalPage>
  );
}
