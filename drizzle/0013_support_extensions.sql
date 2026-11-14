CREATE TABLE support_evidence(id TEXT PRIMARY KEY,ticket TEXT NOT NULL REFERENCES support_tickets(id),actor TEXT NOT NULL,url TEXT NOT NULL,note TEXT NOT NULL,created TEXT NOT NULL);
--> statement-breakpoint
ALTER TABLE support_tickets ADD COLUMN test_id TEXT REFERENCES results(id);
