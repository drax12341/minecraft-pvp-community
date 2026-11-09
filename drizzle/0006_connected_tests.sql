ALTER TABLE high_tests ADD COLUMN queue_id TEXT;
--> statement-breakpoint
CREATE UNIQUE INDEX high_test_assessment ON high_tests(queue_id) WHERE queue_id IS NOT NULL;
--> statement-breakpoint
ALTER TABLE high_tests ADD COLUMN scheduled_at TEXT;
--> statement-breakpoint
ALTER TABLE high_tests ADD COLUMN version INTEGER NOT NULL DEFAULT 0;
