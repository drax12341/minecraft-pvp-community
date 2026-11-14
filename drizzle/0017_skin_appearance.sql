CREATE TABLE skin_previews(uuid TEXT PRIMARY KEY,provider TEXT NOT NULL,head_url TEXT NOT NULL,body_url TEXT NOT NULL,texture_url TEXT,checked_at TEXT NOT NULL,expires_at TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX skin_previews_expiry ON skin_previews(expires_at);
