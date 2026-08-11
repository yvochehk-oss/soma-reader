import type { Metadata } from "next";
import { LegalPage } from "@/app/components/legal-page";
import { CONTACT_EMAIL } from "@/app/lib/site-config";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms for using the Soma Novel reading service.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" intro="Effective date: August 8, 2026. By using Soma Novel, you agree to use the service lawfully and respectfully under these terms.">
      <section>
        <h2>Using Soma Novel</h2>
        <p>Soma Novel provides a platform for discovering and reading web novels. You may browse public pages and use the reading features for personal, non-commercial use. You must provide accurate information when creating an account and keep your sign-in link or account credentials secure.</p>
      </section>

      <section>
        <h2>Content and intellectual property</h2>
        <p>Books, covers, text, branding, software, and other material on Soma Novel may be protected by copyright, trademark, or other rights. You may read and share links to public pages, but you may not copy, republish, sell, scrape, distribute, or create derivative services from the material without permission from the applicable rights holder.</p>
        <p>If you believe content has been published without authorization, please contact us through the <a href="/contact">Contact page</a>.</p>
      </section>

      <section>
        <h2>Prohibited use</h2>
        <ul>
          <li>Do not interfere with the service, bypass access controls, or attempt to access administrative or private systems.</li>
          <li>Do not use automated tools to overload the service, collect personal information, or reproduce the catalogue.</li>
          <li>Do not upload or submit material that is unlawful, malicious, infringing, deceptive, or abusive.</li>
          <li>Do not use the service to distribute malware, spam, or unauthorized advertising.</li>
        </ul>
      </section>

      <section>
        <h2>Advertising and third-party services</h2>
        <p>The service may display advertisements, including Google AdSense advertisements, and may link to third-party services. Third-party services have their own terms and policies. We do not control every third-party website or guarantee its availability, content, or privacy practices.</p>
      </section>

      <section>
        <h2>Availability and changes</h2>
        <p>We work to keep the catalogue and reading tools available, but the service may change, pause, or become unavailable for maintenance, security, provider outages, or other reasons. We may update these terms as the service changes. The effective date at the top will show when the current version was published.</p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>Questions about these terms can be sent to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
      </section>
    </LegalPage>
  );
}
