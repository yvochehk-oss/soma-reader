import { cookies } from "next/headers";
import type { UiLocale } from "@/app/lib/ui-copy";

export const CONTENT_LANGUAGE_COOKIE = "soma-ui-language";

export async function getContentLocale(): Promise<UiLocale> {
  const value = (await cookies()).get(CONTENT_LANGUAGE_COOKIE)?.value;
  return value === "sw" ? "sw" : "en";
}
