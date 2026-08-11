import type { Metadata } from "next";
import { LegalPage } from "@/app/components/legal-page";
import { CONTACT_EMAIL } from "@/app/lib/site-config";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Soma Novel collects, uses, and protects information when you use the reading service.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy Policy" intro="Effective date: August 8, 2026. This policy explains how Soma Novel handles information when you browse, read, or use an account on the service.">
      <section>
        <h2>Information we collect</h2>
        <p>When you browse public pages, we may receive ordinary technical information from your browser and hosting infrastructure, such as an IP address, device type, browser, requested page, and approximate time of access.</p>
        <p>If you sign in, our authentication provider may process your email address, account identifier, and authentication events so we can provide your account and keep it secure.</p>
        <p>When you use reading features, we may process your saved books, reading progress, chapter activity, language preference, reader settings, and offline-download status. Some preferences and offline reading data are stored locally in your browser.</p>
      </section>

      <section>
        <h2>How we use information</h2>
        <ul>
          <li>To provide the catalogue, reading pages, account features, and offline reading tools.</li>
          <li>To remember your preferences and synchronize your shelf or progress when you choose to sign in.</li>
          <li>To understand aggregate reading activity, protect the service, prevent abuse, and fix technical problems.</li>
          <li>To respond to privacy, copyright, advertising, or general service enquiries.</li>
        </ul>
      </section>

      <section>
        <h2>Cookies, local storage, and advertising</h2>
        <p>Soma Novel uses cookies and browser storage for functions such as language selection, authentication, saved books, reading progress, reader settings, and security. You can control cookies through your browser, but some features may not work correctly if you disable them.</p>
        <p>We use Google AdSense to display advertising. Google and its partners may use cookies or similar technologies to show and measure ads based on visits to this and other websites. You can manage personalized advertising through <a href="https://adssettings.google.com/" rel="noreferrer">Google Ads Settings</a>. Google’s own privacy policy and advertising policies also apply to its services.</p>
      </section>

      <section>
        <h2>Service providers</h2>
        <p>We use infrastructure and service providers such as Cloudflare for delivery and security, Supabase for authentication and database services, and Google for advertising. These providers process information only as needed to provide their services, subject to their own terms and privacy policies.</p>
      </section>

      <section>
        <h2>Retention and your choices</h2>
        <p>We retain account and reading information only for as long as needed to provide the service, meet legal obligations, resolve disputes, and maintain security. You may clear browser storage from your browser settings, and you may ask us about access, correction, or deletion of information associated with your account.</p>
        <p>We do not sell personal information. We may disclose information when required by law, to protect users and the service, or to investigate fraud, abuse, or security incidents.</p>
      </section>

      <section>
        <h2>Children</h2>
        <p>Soma Novel is not directed to children under the minimum age required by applicable law. We do not knowingly collect personal information from children for advertising or account creation.</p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>For a privacy request or question about this policy, email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
      </section>
    </LegalPage>
  );
}
