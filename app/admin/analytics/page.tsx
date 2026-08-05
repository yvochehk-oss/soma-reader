import { AnalyticsCards } from "@/app/components/analytics-cards";
import { T } from "@/app/components/language-provider";

export const metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return <main className="shell admin-main"><div className="admin-title-row"><div><p className="eyebrow"><T id="readerSignals" /></p><h1><T id="analytics" /></h1></div><span className="filter filter-active"><T id="last7Days" /></span></div><AnalyticsCards /><section className="admin-panel analytics-panel"><div className="admin-panel-heading"><div><p className="eyebrow"><T id="coreFunnel" /></p><h2><T id="clickToReturn" /></h2></div></div><div className="funnel funnel-large"><div><span>Ad click</span><strong>100%</strong></div><div><span><T id="bookDetail" /></span><strong>—</strong></div><div><span><T id="chapter1Completion" /></span><strong>—</strong></div><div><span><T id="chapter3Reach" /></span><strong>—</strong></div><div><span><T id="nextDayReturn" /></span><strong>—</strong></div></div></section></main>;
}
