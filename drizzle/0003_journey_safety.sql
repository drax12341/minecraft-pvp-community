ALTER TABLE accounts ADD COLUMN verified_at TEXT;
--> statement-breakpoint
ALTER TABLE placement_reviews ADD COLUMN evidence TEXT;
--> statement-breakpoint
CREATE TABLE tester_qualifications(user TEXT NOT NULL,mode TEXT NOT NULL,senior INTEGER NOT NULL DEFAULT 0,actor TEXT NOT NULL,reason TEXT NOT NULL,updated TEXT NOT NULL,PRIMARY KEY(user,mode));
--> statement-breakpoint
CREATE TABLE waitlists(user TEXT NOT NULL,mode TEXT NOT NULL,region TEXT NOT NULL,created TEXT NOT NULL,PRIMARY KEY(user,mode));
--> statement-breakpoint
CREATE TABLE test_rooms(id TEXT PRIMARY KEY,channel TEXT UNIQUE,assignment TEXT NOT NULL,tester TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'creating',ready_by TEXT NOT NULL,player_ready INTEGER NOT NULL DEFAULT 0,tester_ready INTEGER NOT NULL DEFAULT 0,kit_version TEXT NOT NULL,updated TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE ticket_notes(id TEXT PRIMARY KEY,ticket TEXT NOT NULL,actor TEXT NOT NULL,note TEXT NOT NULL,created TEXT NOT NULL);
--> statement-breakpoint
ALTER TABLE support_tickets ADD COLUMN workflow TEXT NOT NULL DEFAULT 'waiting-staff';
--> statement-breakpoint
CREATE TABLE ticket_drafts(id TEXT PRIMARY KEY,user TEXT NOT NULL,kind TEXT NOT NULL,subject TEXT NOT NULL,detail TEXT NOT NULL,expires TEXT NOT NULL);
--> statement-breakpoint
ALTER TABLE sessions ADD COLUMN kit_version TEXT;
--> statement-breakpoint
ALTER TABLE sessions ADD COLUMN benchmarks TEXT;
--> statement-breakpoint
ALTER TABLE assessments ADD COLUMN kit_version TEXT;
--> statement-breakpoint
ALTER TABLE results ADD COLUMN assessment_revision TEXT;
--> statement-breakpoint
ALTER TABLE results ADD COLUMN kit_version TEXT;
--> statement-breakpoint
ALTER TABLE results ADD COLUMN rubric_version TEXT;
