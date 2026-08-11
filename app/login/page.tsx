import { SiteHeader } from "@/app/components/site-header";
import { LoginForm } from "@/app/components/login-form";
import { SiteFooter } from "@/app/components/site-footer";

export const metadata = { title: "Sign in" };

function safeNextPath(value: string | undefined) {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : "/library";
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <div className="site-page"><SiteHeader /><main className="shell auth-main"><LoginForm next={safeNextPath(next)} /></main><SiteFooter /></div>;
}
