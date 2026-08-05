"use client";

import { useState } from "react";
import { createClient } from "@/app/lib/supabase/browser";
import { supabaseIsConfigured, trackEvent } from "@/app/lib/reader-client";

export function BookActions({ bookId }: { bookId?: string }) {
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");

  async function toggleShelf() {
    if (!bookId || !supabaseIsConfigured()) {
      setMessage("Connect Supabase to save your shelf.");
      return;
    }
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.assign("/login?next=" + encodeURIComponent(location.pathname));
      return;
    }
    const result = await fetch("/api/bookshelf", {
      method: saved ? "DELETE" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bookId }),
    });
    if (!result.ok) {
      setMessage("Could not update your shelf. Please try again.");
      return;
    }
    setSaved(!saved);
    setMessage(saved ? "Removed from your shelf." : "Saved to your shelf.");
    if (!saved) void trackEvent({ eventType: "bookshelf_add", bookId });
  }

  return <div className="book-action-wrap"><button className="button button-secondary" type="button" onClick={toggleShelf}>{saved ? "✓ On your shelf" : "＋ Add to shelf"}</button>{message && <span className="form-note" role="status">{message}</span>}</div>;
}
