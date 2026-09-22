import type { Metadata } from "next";
import { LegalPage } from "@/app/components/legal-page";

export const metadata: Metadata = {
  title: "About Soma Novel — Free Bilingual Web Novels, Re-typeset Classics & Self-Publishing",
  description: "Soma Novel is a free reading site from East Africa. It publishes original web fiction side-by-side in English and Kiswahili, re-typesets a thousand English classics for phone screens, and lets anyone upload their own .txt or .epub manuscripts. / Soma Novel ni tovuti ya kusoma bure kutoka Afrika Mashariki. Inachapisha riwaya za mtandaoni kwa Kiingereza na Kiswahili, inapanga upya vitabu elfu moja vya kale vya Kiingereza kwa skrini za simu, na inaruhusu mtu yeyote kupakia hati zake za .txt au .epub.",
};

export default function AboutPage() {
  return (
    <LegalPage title="About Soma Novel" intro="Soma Novel is a free reading site from East Africa with two catalogue sections and three free services. / Soma Novel ni tovuti ya kusoma bure kutoka Afrika Mashariki yenye sehemu mbili za orodha ya vitabu na huduma tatu bure.">
      <section>
        <h2>Two catalogue sections / Sehemu mbili za orodha ya vitabu</h2>
        <p><strong>Original web fiction / Riwaya za mtandaoni za asili.</strong> Hundreds of English and Kiswahili editions, published side-by-side. Every title has both an English and a Kiswahili version, so a reader can start a chapter in one language and finish it in the other without losing their place. / Toleo la Kiingereza na Kiswahili zinachapishwa kwa pamoja. Kila kitabu kina toleo la Kiingereza na Kiswahili, hivyo msomaji anaweza kuanza sura kwa lugha moja na kuimaliza kwa nyingine bila kupoteza mahali alipo.</p>
        <p><strong>Re-typeset English classics / Vitabu vya kale vya Kiingereza vimepangwa upya.</strong> More than a thousand public-domain English works — novels, short stories, and reference books — have been professionally re-typeset for phone screens. These are English only, because the underlying source language is English. Kiswahili translations are not produced for the classics section. / Zaidi ya vitabu elfu moja vya kale vya Kiingereza — novela, hadithi fupi, na vitabu vya marejeleo — vimepangwa upya kitaalamu kwa skrini za simu. Hivi ni vya Kiingereza pekee, kwa sababu lugha ya chanzo ni Kiingereza. Tafsiri za Kiswahili hazitengenezwi kwa sehemu ya vitabu vya kale.</p>
      </section>

      <section>
        <h2>Three things Soma Novel does / Mambo matatu anayofanya Soma Novel</h2>
        <p><strong>1. Bilingual web fiction (爽文).</strong> Every original serial is published side-by-side in English and Kiswahili, so a reader can start a chapter in English and finish it in Kiswahili without losing their place. Every book is fully free to read online and free to download as a complete book (TXT or EPUB). / <strong>Riwaya za mtandaoni (爽文) katika lugha mbili.</strong> Kila riwaya ya asili inachapishwa kwa Kiingereza na Kiswahili kwa pamoja, hivyo msomaji anaweza kuanza sura kwa Kiingereza na kuimaliza kwa Kiswahili bila kupoteza mahali alipo. Kila kitabu ni bure kabisa kusoma mtandaoni na bure kupakua kitabu kizima (TXT au EPUB).</p>
        <p><strong>2. Re-typeset English classics.</strong> More than a thousand public-domain English works — novels, short stories, and reference books — have been professionally re-typeset for phone screens, with cleaner line spacing, sensible margins, and a distraction-free reader. Every classic is free to read online and free to download as a complete book. (English only.) / <strong>Vitabu vya kale vya Kiingereza vimepangwa upya.</strong> Zaidi ya vitabu elfu moja vya kale vya Kiingereza — novela, hadithi fupi, na vitabu vya marejeleo — vimepangwa upya kitaalamu kwa skrini za simu, na nafasi safi za mistari, kingo nzuri, na msomaji asiyepotoshwa. Kila kitabu cha kale ni bure kusoma mtandaoni na bure kupakua kitabu kizima. (Kiingereza pekee.)</p>
        <p><strong>3. Self-publishing.</strong> Readers can upload their own manuscripts in plain text (.txt) or EPUB (.epub) through the in-page uploader. The uploader accepts English and Kiswahili. The reader parses the file, splits it into chapters, and makes it readable immediately, free of charge. / <strong>Kuchapisha mwenyewe.</strong> Wasomaji wanaweza kupakia hati zao za .txt au .epub kupitia kifungu cha kupakia. Kifungu cha kupakia kinakubali Kiingereza na Kiswahili. Kifungu hufasiri faili, kugawanya sura, na kufanya iweze kusomwa mara moja, bila malipo.</p>
      </section>

      <section>
        <h2>Our approach / Mbinu yetu</h2>
        <p>We aim to provide a calm, accessible reading experience and to make the language and cultural context of each story clear. We continue to improve the catalogue, translations, accessibility, and reading tools as the service grows. / Tunataka kutoa uzoefu wa kusoma tulivu na rahisi, na kufanya lugha na muktadha wa kitabu kila chapisho kuwa wazi. Tunaendelea kuboresha orodha ya vitabu, tafsiri, ufikiaji, na zana za kusoma kadri huduma inavyokua.</p>
      </section>

      <section>
        <h2>Questions about a title? / Maswali kuhusu kitabu?</h2>
        <p>If you have a question about a book, author attribution, copyright, or a technical problem, please use our <a href="/contact">Contact page</a>. / Una swali kuhusu kitabu, jina la mwandishi, haki za kunakili, au tatizo la kiufundi, tafadhali tumia ukurasa wetu wa <a href="/contact">Mawasiliano</a>.</p>
      </section>
    </LegalPage>
  );
}
