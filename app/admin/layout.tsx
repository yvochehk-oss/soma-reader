import { AdminHeader } from "@/app/components/admin-header";
import { redirect } from "next/navigation";
import { requireEditor } from "@/app/lib/admin-access";
import { getPublicSupabaseEnv } from "@/app/lib/supabase/server";

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { url, key } = await getPublicSupabaseEnv();
  if (url && key) {
    const { user, allowed } = await requireEditor();
    if (!user) redirect("/login?next=/admin");
    if (!allowed) redirect("/");
  }
  return <div className="admin-page"><AdminHeader />{children}</div>;
}
