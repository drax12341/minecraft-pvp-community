CREATE TABLE retirements(id TEXT PRIMARY KEY,user TEXT NOT NULL,uuid TEXT NOT NULL,mode TEXT NOT NULL,result_id TEXT NOT NULL,reason TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',reviewer TEXT,decision TEXT,created TEXT NOT NULL,updated TEXT NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX one_active_retirement ON retirements(user,mode) WHERE status IN ('pending','approved');
--> statement-breakpoint
CREATE INDEX retirement_placement ON retirements(uuid,mode,result_id,status);
--> statement-breakpoint
CREATE TABLE queue_boards(mode TEXT NOT NULL,region TEXT NOT NULL,channel TEXT NOT NULL,message TEXT NOT NULL,PRIMARY KEY(mode,region));
