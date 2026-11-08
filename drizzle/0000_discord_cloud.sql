CREATE TABLE accounts(discord TEXT PRIMARY KEY,uuid TEXT UNIQUE NOT NULL,name TEXT NOT NULL,verified_by TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE queue(id TEXT PRIMARY KEY,user TEXT NOT NULL,mode TEXT NOT NULL,region TEXT NOT NULL,created TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'waiting',tester TEXT);
--> statement-breakpoint
CREATE UNIQUE INDEX one_queue ON queue(user,mode) WHERE status IN ('waiting','claimed');
--> statement-breakpoint
CREATE TABLE results(sequence INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT UNIQUE NOT NULL,uuid TEXT NOT NULL,name TEXT NOT NULL,region TEXT NOT NULL,mode TEXT NOT NULL,tier INTEGER NOT NULL,pos INTEGER NOT NULL,tester TEXT NOT NULL,evidence TEXT NOT NULL,created TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE audit(id INTEGER PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,subject TEXT NOT NULL,created TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE sessions(mode TEXT NOT NULL,region TEXT NOT NULL,status TEXT NOT NULL,capacity INTEGER NOT NULL,cooldown INTEGER NOT NULL,actor TEXT NOT NULL,updated TEXT NOT NULL,PRIMARY KEY(mode,region));
--> statement-breakpoint
CREATE TABLE appeals(id TEXT PRIMARY KEY,result_id TEXT NOT NULL,user TEXT NOT NULL,reason TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',reviewer TEXT,decision TEXT,created TEXT NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX one_pending_appeal ON appeals(result_id) WHERE status='pending';
--> statement-breakpoint
CREATE TABLE revoked(result_id TEXT PRIMARY KEY,actor TEXT NOT NULL,reason TEXT NOT NULL,created TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE interaction_receipts(id TEXT PRIMARY KEY,created TEXT NOT NULL,status TEXT NOT NULL,response TEXT);
--> statement-breakpoint
CREATE INDEX receipts_age ON interaction_receipts(created);
--> statement-breakpoint
CREATE INDEX results_uuid_mode ON results(uuid,mode,sequence);
--> statement-breakpoint
CREATE INDEX queue_session_status ON queue(mode,region,status);
