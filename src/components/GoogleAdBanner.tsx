import React, { useEffect } from 'react';

interface GoogleAdBannerProps {
  slotId?: string;
  format?: 'auto' | 'fluid' | 'rectangle';
  className?: string;
}

export const GoogleAdBanner: React.FC<GoogleAdBannerProps> = ({
  slotId = "6127427193371021",
  format = "auto",
  className = "",
}) => {
  const publisherId = import.meta.env.VITE_GOOGLE_ADSENSE_PUB_ID || "ca-pub-6127427193371021";

  useEffect(() => {
    if (publisherId) {
      try {
        // @ts-ignore
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {
        console.warn("Google AdSense push error:", e);
      }
    }
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
