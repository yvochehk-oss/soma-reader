import type { Metadata } from "next";
import { LegalPage } from "@/app/components/legal-page";
import { CONTACT_EMAIL } from "@/app/lib/site-config";

export const metadata: Metadata = {
  title: "Contact Soma Novel",
  description: "Contact Soma Novel about privacy, copyright, advertising, books, or technical issues.",
};

export default function ContactPage() {
  return (
    <LegalPage title="Contact Soma Novel" intro="For questions about the service, books, privacy, advertising, or copyright, contact the Soma Novel team by email.">
      <section>
        <h2>Email</h2>
        <p className="contact-email"><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
        <p>Please include the page or book title involved and a short description of the issue. Do not send passwords, payment details, or other sensitive information by email.</p>
      </section>

      <section>
        <h2>Copyright and takedown requests</h2>
        <p>If you believe material on the service infringes your rights, send the relevant URL, identify the work and rights holder, explain the concern, and provide a way to verify your request. We will review a complete notice and respond as appropriate.</p>
      </section>

      <section>
        <h2>Privacy requests</h2>
        <p>For access, correction, or deletion requests, include the account email or other details needed to identify the relevant account. See our <a href="/privacy-policy">Privacy Policy</a> for more information.</p>
      </section>
    </LegalPage>
  );
}
