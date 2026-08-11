import React, { useEffect, useState } from 'react';

const CONSENT_KEY = 'soma-ads-consent';
const CONSENT_EVENT = 'soma-ads-consent-changed';

function loadAdsenseScript() {
  if (document.querySelector('script[data-soma-adsense]')) return;
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6127427193371021';
  script.crossOrigin = 'anonymous';
  script.setAttribute('data-soma-adsense', 'true');
  document.head.appendChild(script);
}

export const CookieConsent: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [hasChoice, setHasChoice] = useState(false);

  useEffect(() => {
    let consent: string | null = null;
    try { consent = localStorage.getItem(CONSENT_KEY); } catch { /* Use the banner when storage is unavailable. */ }
    setHasChoice(consent === 'accepted' || consent === 'rejected');
    setOpen(!consent);
    if (consent === 'accepted') loadAdsenseScript();
    const openSettings = () => setOpen(true);
    window.addEventListener('soma-open-cookie-settings', openSettings);
    return () => window.removeEventListener('soma-open-cookie-settings', openSettings);
  }, []);

  function choose(value: 'accepted' | 'rejected') {
    try { localStorage.setItem(CONSENT_KEY, value); } catch { /* Consent remains session-only if storage is unavailable. */ }
    setHasChoice(true);
    setOpen(false);
    if (value === 'accepted') loadAdsenseScript();
    window.dispatchEvent(new Event(CONSENT_EVENT));
  }

  if (!open && !hasChoice) return null;
  return (
    <>
      {open && <div className="fixed z-[200] right-3 bottom-3 left-3 md:right-6 md:left-6 md:mx-auto md:max-w-4xl rounded-2xl border border-[#203432]/20 bg-white p-4 md:flex md:items-center md:justify-between md:gap-6 shadow-2xl" role="dialog" aria-labelledby="cookie-consent-title">
        <div>
          <p id="cookie-consent-title" className="font-extrabold text-sm text-[#0a1f1d]">Cookie settings</p>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#6E7E7A]">We use necessary storage for language, sign-in, and reading features. With your permission, Google AdSense may use advertising cookies. Read our <a className="text-[#a43d17] underline" href="/cookie-policy">Cookie Policy</a>.</p>
        </div>
        <div className="mt-3 flex gap-2 md:mt-0 md:shrink-0">
          <button type="button" className="flex-1 rounded-lg border border-[#e5e8e2] bg-[#f8f7f2] px-3 py-2 text-[11px] font-extrabold text-[#0a1f1d] md:flex-none" onClick={() => choose('rejected')}>Reject non-essential</button>
          <button type="button" className="flex-1 rounded-lg bg-[#ed7248] px-3 py-2 text-[11px] font-extrabold text-white md:flex-none" onClick={() => choose('accepted')}>Accept advertising cookies</button>
        </div>
      </div>}
      {!open && <button type="button" className="fixed z-[199] right-3 bottom-[70px] rounded-full border border-[#203432]/20 bg-white/95 px-3 py-2 text-[10px] font-extrabold text-[#6E7E7A] shadow-lg" onClick={() => setOpen(true)}>Cookie settings</button>}
    </>
  );
};
