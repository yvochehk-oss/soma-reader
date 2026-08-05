"use client";

import { useEffect } from "react";
import { trackEvent } from "@/app/lib/reader-client";

export function BookViewTracker({ bookId }: { bookId?: string }) {
  useEffect(() => { void trackEvent({ eventType: "book_view", bookId }); }, [bookId]);
  return null;
}
