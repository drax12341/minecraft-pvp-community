ALTER TABLE account_challenges ADD COLUMN method TEXT NOT NULL DEFAULT 'online-server' CHECK(method IN ('online-server','skin'));
--> statement-breakpoint
ALTER TABLE account_challenges ADD COLUMN last_checked TEXT;
