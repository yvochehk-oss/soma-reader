"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/app/lib/supabase/browser";
import { supabaseIsConfigured } from "@/app/lib/reader-client";
import { useTranslation } from "@/app/components/language-provider";

export function LoginForm({ next }: { next: string }) {
  const { t } = useTranslation();
  const googleAuthEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);
  function callbackUrl() {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || location.origin;
    return `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`;
  }
  async function emailLogin() {
    if (!supabaseIsConfigured()) { setStatus("Supabase is not connected yet."); return; }
    setSending(true); setStatus("");
    const { error } = await createClient().auth.signInWithOtp({ email, options: { emailRedirectTo: callbackUrl() } });
    setSending(false);
    setStatus(error ? `${t("authError")} ${error.message}` : t("checkEmail"));
  }
  async function googleLogin() {
    if (!supabaseIsConfigured()) { setStatus("Supabase is not connected yet."); return; }
    const { error } = await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: callbackUrl() } });
    if (error) setStatus(t("authError"));
  }
  return <div className="auth-card"><span className="brand-mark">S</span><p className="eyebrow">{t("keepPlace")}</p><h1>{t("welcomeBack")}</h1><p className="auth-copy">{t("authCopy")}</p>{googleAuthEnabled && <><button className="auth-button" type="button" onClick={googleLogin}>{t("google")}</button><div className="auth-divider"><span>{t("orEmail")}</span></div></>}<label className="input-label" htmlFor="email">{t("emailAddress")}</label><input className="auth-input" id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /><button className="button button-primary auth-submit" type="button" disabled={!email || sending} onClick={emailLogin}>{t("sendCode")} <span>→</span></button>{status && <p className="form-note" role="status">{status}</p>}<p className="auth-guest">{t("guest")} <Link href="/discover">{t("keepGuest")}</Link>.</p></div>;
}
