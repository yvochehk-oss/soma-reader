import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";

const EVENT_TYPES = new Set(["book_view", "chapter_start", "chapter_25", "chapter_50", "chapter_75", "chapter_complete", "bookshelf_add", "offline_download"]);
const CHAPTER_EVENT_TYPES = new Set(["chapter_start", "chapter_25", "chapter_50", "chapter_75", "chapter_complete", "offline_download"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_REQUEST_BYTES = 4096;

function optionalUuid(value: unknown) {
  return value == null || value === "" ? null : typeof value === "string" && UUID.test(value) ? value : undefined;
}

async function readBodyWithLimit(request: Request) {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let body = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytesRead += value.byteLength;
    if (bytesRead > MAX_REQUEST_BYTES) {
      await reader.cancel();
      return null;
    }
    body += decoder.decode(value, { stream: true });
  }

  return body + decoder.decode();
}

export async function POST(request: Request) {
  try {
    if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
      return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
    }
    const contentLength = request.headers.get("content-length");
    if (contentLength !== null) {
      const declaredBytes = Number(contentLength);
      if (!Number.isSafeInteger(declaredBytes) || declaredBytes < 0) return NextResponse.json({ error: "Invalid Content-Length" }, { status: 400 });
      if (declaredBytes > MAX_REQUEST_BYTES) return NextResponse.json({ error: "Request too large" }, { status: 413 });
    }
    const rawBody = await readBodyWithLimit(request);
    if (rawBody === null) return NextResponse.json({ error: "Request too large" }, { status: 413 });
    const parsedBody: unknown = JSON.parse(rawBody);
    if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
      return NextResponse.json({ error: "Invalid event" }, { status: 400 });
    }
    const body = parsedBody as Record<string, unknown>;
    const eventType = typeof body.eventType === "string" && EVENT_TYPES.has(body.eventType) ? body.eventType : null;
    const bookId = optionalUuid(body.bookId);
    const chapterId = optionalUuid(body.chapterId);
    const anonymousId = typeof body.anonymousId === "string" ? body.anonymousId.trim() : "";
    const readingSeconds = body.readingSeconds == null ? null : body.readingSeconds;
    if (!eventType || !bookId || chapterId === undefined || (CHAPTER_EVENT_TYPES.has(eventType) && !chapterId) || (readingSeconds !== null && (typeof readingSeconds !== "number" || !Number.isInteger(readingSeconds) || readingSeconds < 0 || readingSeconds > 86400))) {
      return NextResponse.json({ error: "Invalid event" }, { status: 400 });
    }
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user && !UUID.test(anonymousId)) return NextResponse.json({ error: "Invalid anonymous identifier" }, { status: 400 });
    const { error } = await supabase.from("reading_events").insert({ user_id: user?.id ?? null, anonymous_id: user ? null : anonymousId, book_id: bookId, chapter_id: chapterId, event_type: eventType, reading_seconds: readingSeconds });
    if (error?.code === "P0001") return NextResponse.json({ error: "Event rate limit exceeded" }, { status: 429, headers: { "Retry-After": "60" } });
    if (error) return NextResponse.json({ error: "Unable to record event" }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
}
