import Link from "next/link";
import { CONTACT_EMAIL, SITE_NAME } from "@/app/lib/site-config";

const legalLinks = [
  ["About", "/about"],
  ["Contact", "/contact"],
  ["Privacy Policy", "/privacy-policy"],
  ["Cookie Policy", "/cookie-policy"],
  ["Terms of Service", "/terms"],
] as const;

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell site-footer-inner">
        <div>
          <Link href="/" className="site-footer-brand">{SITE_NAME}</Link>
          <p className="site-footer-copy">A reading home for English and Kiswahili web novels from East Africa.</p>
        </div>
        <nav className="site-footer-links" aria-label="Legal and site information">
          {legalLinks.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}
          <a href={`mailto:${CONTACT_EMAIL}`}>Email us</a>
        </nav>
      </div>
      <div className="shell site-footer-bottom">
        <span>© 2026 {SITE_NAME}</span>
        <span>Stories in English and Kiswahili</span>
      </div>
    </footer>
  );
}
