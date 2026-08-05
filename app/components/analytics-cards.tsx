"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/app/components/language-provider";

type Metrics = { bookViews: number; chapterOneCompletions: number; chapterThreeStarts: number; downloads: number; published: number; readersToday: number };

export function AnalyticsCards({ overview = false }: { overview?: boolean }) {
  const { t } = useTranslation();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  useEffect(() => { fetch("/api/admin/analytics").then((response) => response.ok ? response.json() : null).then(setMetrics).catch(() => setMetrics(null)); }, []);
  const value = (key: keyof Metrics) => metrics ? metrics[key].toLocaleString() : "—";
  if (overview) return <div className="metric-grid"><div className="metric-card"><span>{t("readersToday")}</span><strong>{value("readersToday")}</strong></div><div className="metric-card"><span>{t("chaptersRead")}</span><strong>{value("chapterOneCompletions")}</strong></div><div className="metric-card"><span>{t("booksPublished")}</span><strong>{value("published")}</strong></div><div className="metric-card"><span>{t("returnRate")}</span><strong>—</strong><small>After enough event history</small></div></div>;
  return <div className="analytics-grid"><div className="analytics-card"><span>{t("bookViews")}</span><strong>{value("bookViews")}</strong><small>{t("last7Days")}</small></div><div className="analytics-card"><span>{t("chapter1Completion")}</span><strong>{value("chapterOneCompletions")}</strong><small>{t("last7Days")}</small></div><div className="analytics-card"><span>{t("chapter3Reach")}</span><strong>{value("chapterThreeStarts")}</strong><small>{t("last7Days")}</small></div><div className="analytics-card"><span>{t("offlineDownloads")}</span><strong>{value("downloads")}</strong><small>{t("last7Days")}</small></div></div>;
}
