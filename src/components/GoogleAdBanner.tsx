import React, { useEffect } from 'react';

const ADSENSE_CONSENT_KEY = 'soma-ads-consent';
const ADSENSE_CONSENT_EVENT = 'soma-ads-consent-changed';

function hasAdsConsent() {
  try { return localStorage.getItem(ADSENSE_CONSENT_KEY) === 'accepted'; } catch { return false; }
}

interface GoogleAdBannerProps {
  slotId: string;
  format?: 'auto' | 'fluid' | 'rectangle';
  className?: string;
}

export const GoogleAdBanner: React.FC<GoogleAdBannerProps> = ({
  slotId,
  format = "auto",
  className = "",
}) => {
  const publisherId = import.meta.env.VITE_GOOGLE_ADSENSE_PUB_ID || "ca-pub-6127427193371021";

  useEffect(() => {
    const pushAd = () => {
      if (!publisherId || !hasAdsConsent()) return;
      try {
        // @ts-ignore
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {
        console.warn("Google AdSense push error:", e);
      }
    };
    pushAd();
    window.addEventListener(ADSENSE_CONSENT_EVENT, pushAd);
    return () => window.removeEventListener(ADSENSE_CONSENT_EVENT, pushAd);
  }, [publisherId]);

  return (
    <div className={`w-full flex justify-center my-4 overflow-hidden min-h-[90px] ${className}`}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block', width: '100%' }}
        data-ad-client={publisherId}
        data-ad-slot={slotId}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
};
