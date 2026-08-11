"use client";

import { useEffect, useRef } from "react";
import { ADSENSE_CONSENT_EVENT, ADSENSE_CONSENT_KEY } from "@/app/components/cookie-consent";

const PUBLISHER_ID = "ca-pub-6127427193371021";
const AD_SLOT_ID = "1159270041";

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
        style={{ display: "block" }}
        data-ad-format="fluid"
        data-ad-layout-key="-gc+t-2a-dp+xg"
        data-ad-client={PUBLISHER_ID}
        data-ad-slot={AD_SLOT_ID}
      />
    </div>
  );
}
