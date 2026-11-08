CREATE TABLE practice_posts(id TEXT PRIMARY KEY,user TEXT NOT NULL,mode TEXT NOT NULL,region TEXT NOT NULL,note TEXT NOT NULL,created TEXT NOT NULL,expires TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open');
--> statement-breakpoint
CREATE INDEX practice_active ON practice_posts(status,expires,mode,region);
--> statement-breakpoint
CREATE TABLE tester_applications(id TEXT PRIMARY KEY,user TEXT NOT NULL,mode TEXT NOT NULL,region TEXT NOT NULL,experience TEXT NOT NULL,availability TEXT NOT NULL,created TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',reviewer TEXT,decision TEXT);
--> statement-breakpoint
CREATE UNIQUE INDEX one_tester_application ON tester_applications(user,mode) WHERE status='pending';
