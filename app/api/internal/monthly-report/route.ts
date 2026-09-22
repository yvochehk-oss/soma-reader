import { NextResponse } from "next/server";
import { createAdminClient, getServerSecret } from "@/app/lib/supabase/admin";

type Rollup = { book_id: string | null; event_type: string; event_count: number; unique_readers: number };

function monthWindow() {
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 1, 1));
  return { start, end };
}

function dateOnly(value: Date) { return value.toISOString().slice(0, 10); }
function htmlEscape(value: string) { return value.replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]!); }

export async function POST(request: Request) {
  const expectedSecret = await getServerSecret("CRON_SECRET");
  if (!expectedSecret || request.headers.get("x-soma-cron-secret") !== expectedSecret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const resendApiKey = await getServerSecret("RESEND_API_KEY");
  if (!resendApiKey) return NextResponse.json({ error: "RESEND_API_KEY is not configured" }, { status: 503 });
  const recipient = await getServerSecret("REPORT_RECIPIENT");
  if (!recipient) return NextResponse.json({ error: "REPORT_RECIPIENT is not configured" }, { status: 503 });
  const resendFrom = (await getServerSecret("RESEND_FROM")) ?? "Soma Reports <reports@somanovel.uk>";
  try {
    const admin = await createAdminClient();
    const { start, end } = monthWindow();
    const periodStart = dateOnly(start);
    const periodEnd = dateOnly(end);
    const retentionCutoff = new Date(Date.now() - 90 * 86_400_000).toISOString();
    const { data: existing, error: existingError } = await admin.from("monthly_report_runs").select("id,status").eq("period_start", periodStart).maybeSingle();
    if (existingError) throw existingError;
    if (existing?.status === "sent") {
      const { data: purged, error: purgeError } = await admin.rpc("purge_reading_events_after_report", { report_run_id: existing.id });
      if (purgeError) throw purgeError;
      return NextResponse.json({ ok: true, duplicate: true, purged: purged ?? 0 });
    }
    let runId = existing?.id;
    if (!runId) {
      const { data, error } = await admin.from("monthly_report_runs").insert({ period_start: periodStart, period_end: periodEnd, recipient, retention_cutoff: retentionCutoff }).select("id").single();
      if (error) throw error;
      runId = data.id;
    } else {
      const { error } = await admin.from("monthly_report_runs").update({ status: "pending", error_message: null, retention_cutoff: retentionCutoff }).eq("id", runId);
      if (error) throw error;
    }
    const { error: rollupError } = await admin.rpc("rollup_reading_events", { month_start: periodStart, month_end: periodEnd });
    if (rollupError) throw rollupError;
    const { data: rollups, error: rollupReadError } = await admin.from("monthly_event_rollups").select("book_id,event_type,event_count,unique_readers").eq("period_start", periodStart).order("event_count", { ascending: false });
    if (rollupReadError) throw rollupReadError;
    const bookIds = [...new Set((rollups ?? []).map((row) => row.book_id).filter((id): id is string => Boolean(id)))];
    const { data: books } = bookIds.length ? await admin.from("books").select("id,title").in("id", bookIds) : { data: [] as Array<{ id: string; title: string }> };
    const bookNames = new Map((books ?? []).map((book) => [book.id, book.title]));
    const rows = (rollups ?? []) as Rollup[];
    const totals = new Map<string, number>();
    rows.forEach((row) => totals.set(row.event_type, (totals.get(row.event_type) ?? 0) + Number(row.event_count)));
    const tableRows = rows.map((row) => `<tr><td>${htmlEscape(row.book_id ? bookNames.get(row.book_id) ?? "Deleted book" : "All books")}</td><td>${htmlEscape(row.event_type)}</td><td>${Number(row.event_count).toLocaleString()}</td><td>${Number(row.unique_readers).toLocaleString()}</td></tr>`).join("") || "<tr><td colspan=\"4\">No reading events were recorded.</td></tr>";
    const body = `<h1>Soma monthly reader report</h1><p><strong>${periodStart}</strong> to <strong>${periodEnd}</strong></p><ul><li>Book detail views: ${totals.get("book_view") ?? 0}</li><li>Chapter starts: ${totals.get("chapter_start") ?? 0}</li><li>Chapter completions: ${totals.get("chapter_complete") ?? 0}</li><li>Bookshelf additions: ${totals.get("bookshelf_add") ?? 0}</li><li>Offline downloads: ${totals.get("offline_download") ?? 0}</li></ul><table border="1" cellpadding="8" cellspacing="0"><thead><tr><th>Book</th><th>Event</th><th>Events</th><th>Unique readers</th></tr></thead><tbody>${tableRows}</tbody></table><p>Raw events older than 90 days will be cleared only after this message is accepted by Resend.</p>`;
    const emailResponse = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: resendFrom, to: [recipient], subject: `Soma monthly report: ${periodStart}`, html: body }) });
    const email = await emailResponse.json() as { id?: string; message?: string };
    if (!emailResponse.ok || !email.id) {
      await admin.from("monthly_report_runs").update({ status: "failed", error_message: email.message ?? `Resend HTTP ${emailResponse.status}` }).eq("id", runId);
      return NextResponse.json({ error: "Email was not sent; events were retained." }, { status: 502 });
    }
    const { error: sentError } = await admin.from("monthly_report_runs").update({ status: "sent", resend_message_id: email.id, sent_at: new Date().toISOString(), error_message: null }).eq("id", runId);
    if (sentError) throw sentError;
    const { data: purged, error: purgeError } = await admin.rpc("purge_reading_events_after_report", { report_run_id: runId });
    if (purgeError) throw purgeError;
    return NextResponse.json({ ok: true, periodStart, eventsPurged: purged ?? 0 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Monthly report failed; events were retained." }, { status: 500 });
  }
}
