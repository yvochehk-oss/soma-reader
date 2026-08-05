"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { type UiLocale, uiCopy } from "@/app/lib/ui-copy";

type TranslationContext = { locale: UiLocale; setLocale: (locale: UiLocale) => void; t: (key: string, values?: Record<string, string | number>) => string };
const Context = createContext<TranslationContext | null>(null);

function translate(locale: UiLocale, key: string, values?: Record<string, string | number>) {
  let copy = uiCopy[locale][key] ?? uiCopy.en[key] ?? key;
  for (const [name, value] of Object.entries(values ?? {})) copy = copy.replaceAll(`{${name}}`, String(value));
  return copy;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<UiLocale>("en");
  useEffect(() => {
    const saved = localStorage.getItem("soma-ui-language") as UiLocale | null;
    const initial = saved === "sw" || (!saved && navigator.language.toLowerCase().startsWith("sw")) ? "sw" : "en";
    const timer = window.setTimeout(() => setLocaleState(initial), 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => { document.documentElement.lang = locale; localStorage.setItem("soma-ui-language", locale); document.cookie = `soma-ui-language=${locale}; path=/; max-age=31536000; samesite=lax`; }, [locale]);
  const value = useMemo(() => ({ locale, setLocale: setLocaleState, t: (key: string, values?: Record<string, string | number>) => translate(locale, key, values) }), [locale]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useTranslation() {
  const value = useContext(Context);
  if (!value) throw new Error("useTranslation must be used inside LanguageProvider");
  return value;
}

export function T({ id, values }: { id: string; values?: Record<string, string | number> }) {
  const { t } = useTranslation();
  return <>{t(id, values)}</>;
}

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useTranslation();
  const router = useRouter();
  function changeLanguage(nextLocale: UiLocale) { if (nextLocale !== locale) { setLocale(nextLocale); document.cookie = `soma-ui-language=${nextLocale}; path=/; max-age=31536000; samesite=lax`; router.refresh(); } }
  return <label className="language-switcher"><span className="sr-only">{t("language")}</span><select aria-label={t("language")} value={locale} onChange={(event) => changeLanguage(event.target.value as UiLocale)}><option value="en">{t("english")}</option><option value="sw">{t("kiswahili")}</option></select></label>;
}
