-- ============================================================
-- sw_books_pipeline.db
-- Single source of truth for sw爽文 books pipeline state.
-- Follows AGENTS.md rule §1: local DB is only "what we did";
-- the published_at_remote and remote_audit columns must be
-- cross-checked against somanovel.uk / Supabase every release.
-- ============================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ----------------------------
-- 1. books: one row per book
-- ----------------------------
CREATE TABLE IF NOT EXISTS books (
    book_id           TEXT PRIMARY KEY,        -- e.g. "2026-08-08_nyumba_isiyouzwa"
    slug              TEXT NOT NULL UNIQUE,    -- e.g. "nyumba_isiyouzwa"
    slug_en           TEXT,
    title_sw          TEXT NOT NULL,
    title_en          TEXT,
    author            TEXT NOT NULL,
    author_real       TEXT,
    pool              TEXT,                    -- M / F
    source_slot       TEXT,                    -- 01:00 / 03:00 / 05:00
    run_date          TEXT,                    -- 2026-08-08
    plan_version      TEXT,                    -- 2.3.7-S1 etc.
    handoff_id        TEXT,
    handoff_status    TEXT NOT NULL,           -- COMPLETED / DRAFTING / etc.
    language_pair     TEXT NOT NULL DEFAULT 'sw+en',
    folder_local      TEXT NOT NULL,           -- absolute path to 正文/2026-08-xx_xxx
    folder_remote_gdrive TEXT,                 -- gdrive file_id of final folder
    file_sw_md_id     TEXT,                    -- gdrive file_id of sw_final.md
    file_en_md_id     TEXT,                    -- gdrive file_id of en_final.md
    file_sw_md_sha256 TEXT,
    file_en_md_sha256 TEXT,
    file_cover_sw_id    TEXT,
    file_cover_en_id    TEXT,
    file_cover_sw_sha256 TEXT,
    file_cover_en_sha256 TEXT,
    sync_state        TEXT NOT NULL DEFAULT 'pending',  -- pending / synced / drifted
    cover_state       TEXT NOT NULL DEFAULT 'pending',  -- pending / generated / uploaded
    publish_state     TEXT NOT NULL DEFAULT 'unsent',   -- unsent / releasing / published / failed
    published_slug    TEXT,                    -- live slug on somanovel.uk
    published_remote_status TEXT,              -- published / draft / missing
    published_at_remote TEXT,                  -- ISO-8601 timestamp from somanovel.uk API
    site_url          TEXT,
    audit_json_path   TEXT,                    -- last release audit JSON
    last_error        TEXT,
    notes             TEXT,
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_books_slug ON books(slug);
CREATE INDEX IF NOT EXISTS idx_books_publish_state ON books(publish_state);
CREATE INDEX IF NOT EXISTS idx_books_run_date ON books(run_date);

-- ----------------------------
-- 2. assets: one row per concrete file (md / cover / json)
-- ----------------------------
CREATE TABLE IF NOT EXISTS assets (
    asset_id          INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id           TEXT NOT NULL REFERENCES books(book_id) ON DELETE CASCADE,
    asset_kind        TEXT NOT NULL,           -- 'sw_final_md' / 'en_final_md' / 'cover_sw' / 'cover_en' / 'mobile_cover' / 'story_meta' / 'planning_md' / 'handoff_status' / 'qa_json'
    path_local        TEXT NOT NULL,
    path_remote_gdrive TEXT,
    remote_gdrive_id  TEXT,
    sha256            TEXT,
    size_bytes        INTEGER,
    mime_type         TEXT,
    state_local       TEXT NOT NULL DEFAULT 'present',  -- present / missing / stale
    state_remote      TEXT NOT NULL DEFAULT 'unknown',  -- unknown / absent / present / drifted
    state_qa          TEXT NOT NULL DEFAULT 'unknown',  -- unknown / pass / fail / skipped
    last_verified_at  TEXT,
    last_verified_by  TEXT,                    -- 'gdrive_api' / 'somanovel.uk_api' / 'manual'
    last_error        TEXT,
    updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(book_id, asset_kind)
);

CREATE INDEX IF NOT EXISTS idx_assets_book ON assets(book_id);
CREATE INDEX IF NOT EXISTS idx_assets_kind ON assets(asset_kind);

-- ----------------------------
-- 3. events: ordered audit trail
-- ----------------------------
CREATE TABLE IF NOT EXISTS events (
    event_id          INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id           TEXT REFERENCES books(book_id) ON DELETE CASCADE,
    event_kind        TEXT NOT NULL,           -- 'sync' / 'cover' / 'upload' / 'release' / 'publish' / 'verify' / 'note'
    actor             TEXT,                    -- 'agent' / 'human' / 'release-soma-books.mjs'
    source_command    TEXT,                    -- full CLI string or script path
    result            TEXT NOT NULL,           -- 'success' / 'failure' / 'skipped' / 'pending'
    payload_path      TEXT,                    -- path to JSON / audit file referenced
    payload_sha256    TEXT,
    duration_ms       INTEGER,
    message           TEXT,
    created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_book ON events(book_id);
CREATE INDEX IF NOT EXISTS idx_events_kind ON events(event_kind);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);

-- ----------------------------
-- 4. publishes: one row per release attempt
-- ----------------------------
CREATE TABLE IF NOT EXISTS publishes (
    publish_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id           TEXT NOT NULL REFERENCES books(book_id) ON DELETE CASCADE,
    site_url          TEXT NOT NULL,
    mode              TEXT NOT NULL,           -- 'dry-run' / 'production'
    audit_json_path   TEXT,
    audit_sha256      TEXT,
    supabase_row_id   TEXT,
    remote_status     TEXT,
    remote_chapters   INTEGER,
    remote_cover_url  TEXT,
    remote_slug       TEXT,
    result            TEXT NOT NULL,           -- 'published' / 'updated' / 'failed' / 'skipped'
    error_message     TEXT,
    finished_at       TEXT,
    created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_publishes_book ON publishes(book_id);
CREATE INDEX IF NOT EXISTS idx_publishes_result ON publishes(result);

-- ----------------------------
-- 5. remote_audits: snapshots of somanovel.uk state
-- ----------------------------
CREATE TABLE IF NOT EXISTS remote_audits (
    audit_id          INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id           TEXT REFERENCES books(book_id) ON DELETE CASCADE,
    slug              TEXT,
    site_url          TEXT,
    remote_status     TEXT,
    remote_chapters   INTEGER,
    remote_cover_url  TEXT,
    remote_response_json TEXT,
    source            TEXT,                    -- 'wrangler' / 'book-import' / 'sitemap'
    created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_remote_audits_book ON remote_audits(book_id);
CREATE INDEX IF NOT EXISTS idx_remote_audits_created ON remote_audits(created_at);

-- ----------------------------
-- 6. schema_version
-- ----------------------------
CREATE TABLE IF NOT EXISTS schema_version (
    version           INTEGER PRIMARY KEY,
    applied_at        TEXT NOT NULL DEFAULT (datetime('now')),
    notes             TEXT
);
INSERT OR IGNORE INTO schema_version (version, notes) VALUES
    (1, 'initial schema 2026-08-15 — books, assets, events, publishes, remote_audits');
