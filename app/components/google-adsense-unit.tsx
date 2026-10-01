"use client";

import { useEffect, useRef } from "react";
import { ADSENSE_CONSENT_EVENT, ADSENSE_CONSENT_KEY } from "@/app/components/cookie-consent";
import { ADSENSE_PUBLISHER_ID } from "@/app/lib/adsense";

const AD_SLOT_ID = "6476924726";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

function hasAdsConsent() {
  try { return localStorage.getItem(ADSENSE_CONSENT_KEY) === "accepted"; } catch { return false; }
}

export function GoogleAdSenseUnit() {
  const pushed = useRef(false);

  useEffect(() => {
    function pushAd() {
      if (!hasAdsConsent() || pushed.current) return;
      pushed.current = true;
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (error) {
        pushed.current = false;
        console.warn("Google AdSense push error:", error);
      }
    }
    pushAd();
    window.addEventListener(ADSENSE_CONSENT_EVENT, pushAd);
    return () => window.removeEventListener(ADSENSE_CONSENT_EVENT, pushAd);
  }, []);

  return (
    <div className="reader-ad" aria-label="Advertisement">
      <ins
        className="adsbygoogle"
        style={{ display: "block", textAlign: "center" }}
        data-ad-layout="in-article"
        data-ad-format="fluid"
        data-ad-client={ADSENSE_PUBLISHER_ID}
        data-ad-slot={AD_SLOT_ID}
        data-full-width-responsive="true"
      />
    </div>
  );
}
