import type { Metadata } from "next";
import { LegalPage } from "@/app/components/legal-page";
import { CONTACT_EMAIL } from "@/app/lib/site-config";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "How Soma Novel uses cookies and browser storage for necessary features and advertising.",
};

export default function CookiePolicyPage() {
  return (
    <LegalPage title="Cookie Policy" intro="Effective date: August 8, 2026. This page explains the cookies and browser storage used by Soma Novel.">
      <section>
        <h2>What cookies are</h2>
        <p>Cookies are small pieces of information stored by a website in your browser. Similar browser storage, such as localStorage, can remember settings and offline reading data on your device.</p>
      </section>

      <section>
        <h2>Necessary storage</h2>
        <p>Soma Novel uses necessary cookies and browser storage to remember your language, keep authentication working, save your shelf and reading progress, apply reader settings, provide offline reading, and protect the service. These features may not work correctly if this storage is blocked.</p>
      </section>

      <section>
        <h2>Advertising cookies</h2>
        <p>With your permission, Google AdSense loads its advertising technology and may use cookies or similar technologies to serve, personalize, limit, and measure advertising. If you reject non-essential cookies, Soma Novel does not intentionally load the AdSense script for your session.</p>
        <p>You can manage Google advertising choices through <a href="https://adssettings.google.com/" rel="noreferrer">Google Ads Settings</a>. Google’s privacy policy and advertising policies also apply to Google advertising services.</p>
      </section>

      <section>
        <h2>Your choices</h2>
        <p>Use the Cookie settings button on the site to change your choice. You can also clear cookies and local storage through your browser settings. Clearing storage may sign you out and remove locally saved books, progress, or reader preferences.</p>
      </section>

      <section>
        <h2>Questions</h2>
        <p>Questions about cookies can be sent to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. For broader information about data handling, see our <a href="/privacy-policy">Privacy Policy</a>.</p>
      </section>
    </LegalPage>
  );
}
