import React, { useEffect } from 'react';
import { ADSENSE_PUBLISHER_ID } from '../../app/lib/adsense';

const ADSENSE_CONSENT_KEY = 'soma-ads-consent';
const ADSENSE_CONSENT_EVENT = 'soma-ads-consent-changed';

function hasAdsConsent() {
  try { return localStorage.getItem(ADSENSE_CONSENT_KEY) === 'accepted'; } catch { return false; }
}

interface GoogleAdBannerProps {
  /**
   * AdSense ad unit slot ID. When omitted, the banner runs in `auto-ads`
   * mode: it only registers the page with the previously loaded
   * `adsbygoogle.js` and lets AdSense pick the most appropriate placement.
   * Use auto-ads on the homepage where there is no specific ad unit, and
   * use a real slot ID on dedicated ad placements that the AdSense review
   * team has approved.
   */
  slotId?: string;
  format?: 'auto' | 'fluid' | 'rectangle';
  layout?: string;
  className?: string;
}

export const GoogleAdBanner: React.FC<GoogleAdBannerProps> = ({
  slotId,
  format = 'auto',
  layout,
  className = '',
}) => {
  const publisherId = import.meta.env.VITE_GOOGLE_ADSENSE_PUB_ID || ADSENSE_PUBLISHER_ID;

  useEffect(() => {
    const pushAd = () => {
      if (!publisherId || !hasAdsConsent()) return;
      try {
        // @ts-ignore
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {
        console.warn('Google AdSense push error:', e);
      }
    };
    pushAd();
    window.addEventListener(ADSENSE_CONSENT_EVENT, pushAd);
    return () => window.removeEventListener(ADSENSE_CONSENT_EVENT, pushAd);
  }, [publisherId]);

  return (
    <div className={`w-full flex justify-center my-4 overflow-hidden min-h-[90px] ${className}`} aria-label="Advertisement">
      <ins
        className="adsbygoogle"
        style={{ display: 'block', width: '100%', ...(layout ? { textAlign: 'center' } : {}) }}
        {...(slotId ? { 'data-ad-slot': slotId } : {})}
        {...(layout ? { 'data-ad-layout': layout } : {})}
        data-ad-format={format}
        data-ad-client={publisherId}
        data-full-width-responsive="true"
      />
    </div>
  );
};
