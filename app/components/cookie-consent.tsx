"use client";

import { useEffect, useState } from "react";
import { ADSENSE_AUTO_ADS_SCRIPT_URL } from "@/app/lib/adsense";

export const ADSENSE_CONSENT_KEY = "soma-ads-consent";
export const ADSENSE_CONSENT_EVENT = "soma-ads-consent-changed";
const ADSENSE_SCRIPT_MARKER = "data-soma-adsense";

export function loadAdsenseScript() {
  if (document.querySelector(`script[${ADSENSE_SCRIPT_MARKER}]`)) return;
  const script = document.createElement("script");
  script.async = true;
  script.src = `${ADSENSE_AUTO_ADS_SCRIPT_URL}&autoAds=true`;
  script.crossOrigin = "anonymous";
  script.setAttribute(ADSENSE_SCRIPT_MARKER, "true");
  document.head.appendChild(script);
}

function storedConsent() {
  try {
    return localStorage.getItem(ADSENSE_CONSENT_KEY);
  } catch {
    return null;
  }
}

export function CookieConsent() {
  const [open, setOpen] = useState(false);
  const [hasChoice, setHasChoice] = useState(false);

  useEffect(() => {
    const consent = storedConsent();
    setHasChoice(consent === "accepted" || consent === "rejected");
    setOpen(!consent);
    if (consent === "accepted") loadAdsenseScript();

    const openSettings = () => setOpen(true);
    window.addEventListener("soma-open-cookie-settings", openSettings);
    return () => window.removeEventListener("soma-open-cookie-settings", openSettings);
  }, []);

  function choose(value: "accepted" | "rejected") {
    try { localStorage.setItem(ADSENSE_CONSENT_KEY, value); } catch { /* Consent remains session-only if storage is unavailable. */ }
    setHasChoice(true);
    setOpen(false);
    if (value === "accepted") loadAdsenseScript();
    window.dispatchEvent(new Event(ADSENSE_CONSENT_EVENT));
  }

  if (!open && !hasChoice) return null;

  return (
    <>
      {open && <div className="cookie-consent" role="dialog" aria-modal="false" aria-labelledby="cookie-consent-title">
        <div>
          <p className="cookie-consent-title" id="cookie-consent-title">Cookie settings</p>
          <p className="cookie-consent-copy">We use necessary storage for language, sign-in, and reading features. With your permission, Google AdSense may use advertising cookies to show and measure ads. Read our <a href="/cookie-policy">Cookie Policy</a>.</p>
        </div>
        <div className="cookie-consent-actions">
          <button type="button" className="cookie-button cookie-button-secondary" onClick={() => choose("rejected")}>Reject non-essential</button>
          <button type="button" className="cookie-button cookie-button-primary" onClick={() => choose("accepted")}>Accept advertising cookies</button>
        </div>
      </div>}
      {!open && <button type="button" className="cookie-settings-button" onClick={() => setOpen(true)}>Cookie settings</button>}
    </>
  );
}
