/**
 * Google AdSense configuration shared across the Soma Novel frontend.
 *
 * The publisher ID is intentionally a constant so the cookie consent banner,
 * ad units, and the homepage auto-ads stub all pull from one place. Update
 * this constant if the AdSense account ever changes.
 */

export const ADSENSE_PUBLISHER_ID = "ca-pub-3097294735250340";
export const ADSENSE_AUTO_ADS_SCRIPT_URL =
  `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUBLISHER_ID}`;
