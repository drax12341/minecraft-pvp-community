CREATE TABLE support_tickets(id TEXT PRIMARY KEY,user TEXT NOT NULL,kind TEXT NOT NULL,subject TEXT NOT NULL,detail TEXT NOT NULL,status TEXT NOT NULL,channel TEXT UNIQUE,claimed_by TEXT,created TEXT NOT NULL,closed TEXT,closed_by TEXT,close_reason TEXT);
--> statement-breakpoint
CREATE UNIQUE INDEX one_ticket_per_kind ON support_tickets(user,kind) WHERE status IN ('creating','open','closing');
--> statement-breakpoint
CREATE INDEX tickets_status ON support_tickets(status,created);
--> statement-breakpoint
CREATE TABLE staff_applications(id TEXT PRIMARY KEY,user TEXT NOT NULL,track TEXT NOT NULL,experience TEXT NOT NULL,availability TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',reviewer TEXT,decision TEXT,created TEXT NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX one_staff_application ON staff_applications(user,track) WHERE status='pending';
--> statement-breakpoint
CREATE TABLE assessments(id TEXT PRIMARY KEY,tester TEXT NOT NULL,mode TEXT NOT NULL,version TEXT NOT NULL,scores TEXT NOT NULL,total REAL NOT NULL,rationale TEXT NOT NULL,created TEXT NOT NULL,revision TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE placement_reviews(review_id TEXT PRIMARY KEY,id TEXT NOT NULL,reviewer TEXT NOT NULL,tier TEXT NOT NULL,reason TEXT NOT NULL,created TEXT NOT NULL,assessment_revision TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE assessment_history(revision TEXT PRIMARY KEY,id TEXT NOT NULL,tester TEXT NOT NULL,scores TEXT NOT NULL,total REAL NOT NULL,rationale TEXT NOT NULL,created TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE moderation_cases(id TEXT PRIMARY KEY,user TEXT NOT NULL,actor TEXT NOT NULL,reason TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open',created TEXT NOT NULL,resolver TEXT,resolution TEXT);
