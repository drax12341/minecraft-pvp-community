CREATE TABLE account_challenges(user TEXT PRIMARY KEY,uuid TEXT NOT NULL,name TEXT NOT NULL,token_hash TEXT UNIQUE NOT NULL,created TEXT NOT NULL,expires TEXT NOT NULL,consumed TEXT);
--> statement-breakpoint
CREATE TABLE cooldowns(user TEXT NOT NULL,mode TEXT NOT NULL,result_id TEXT NOT NULL REFERENCES results(id),until_at TEXT NOT NULL,PRIMARY KEY(user,mode));
--> statement-breakpoint
CREATE TABLE notification_preferences(user TEXT PRIMARY KEY,delivery TEXT NOT NULL DEFAULT 'none' CHECK(delivery IN ('dm','none')));
--> statement-breakpoint
CREATE TABLE outbox_events(id INTEGER PRIMARY KEY AUTOINCREMENT,kind TEXT NOT NULL,subject TEXT NOT NULL,payload TEXT NOT NULL DEFAULT '{}',status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','done')),attempts INTEGER NOT NULL DEFAULT 0,available_at TEXT NOT NULL,lease TEXT,lease_until TEXT,last_error TEXT,created TEXT NOT NULL,UNIQUE(kind,subject));
--> statement-breakpoint
CREATE INDEX outbox_due ON outbox_events(status,available_at);
--> statement-breakpoint
CREATE TABLE tier_role_mappings(mode TEXT NOT NULL,tier TEXT NOT NULL CHECK(tier IN ('HT1','LT1','HT2','LT2','HT3','LT3','HT4','LT4','HT5','LT5')),role TEXT NOT NULL UNIQUE,PRIMARY KEY(mode,tier));
--> statement-breakpoint
CREATE TABLE session_alerts(mode TEXT NOT NULL,region TEXT NOT NULL,last_sent TEXT NOT NULL,PRIMARY KEY(mode,region));
--> statement-breakpoint
CREATE TABLE result_drafts(id TEXT PRIMARY KEY,test_id TEXT NOT NULL REFERENCES queue(id),tester TEXT NOT NULL,tier TEXT NOT NULL,evidence TEXT NOT NULL,expires TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE platform_panels(key TEXT PRIMARY KEY,channel TEXT NOT NULL,message TEXT NOT NULL,fingerprint TEXT,last_edit TEXT,lease_until TEXT);
--> statement-breakpoint
CREATE TRIGGER queue_join_audit AFTER INSERT ON queue BEGIN INSERT INTO audit(actor,action,subject,created) VALUES(NEW.user,'queue-joined',NEW.id,strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;
--> statement-breakpoint
CREATE TRIGGER queue_transition_audit AFTER UPDATE OF status ON queue WHEN OLD.status<>NEW.status BEGIN INSERT INTO audit(actor,action,subject,created) VALUES(COALESCE(NEW.tester,NEW.user),'queue:'||OLD.status||'->'||NEW.status,NEW.id,strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;
--> statement-breakpoint
CREATE TRIGGER room_transition_audit AFTER UPDATE ON test_rooms WHEN OLD.state<>NEW.state OR OLD.player_ready<>NEW.player_ready OR OLD.tester_ready<>NEW.tester_ready BEGIN INSERT INTO audit(actor,action,subject,created) VALUES(CASE WHEN OLD.player_ready<>NEW.player_ready THEN (SELECT user FROM queue WHERE id=NEW.id) ELSE NEW.tester END,'room:'||OLD.state||'->'||NEW.state||':ready='||NEW.player_ready||'/'||NEW.tester_ready,NEW.id,strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;
--> statement-breakpoint
CREATE TRIGGER finalized_result_audit AFTER INSERT ON results BEGIN INSERT INTO audit(actor,action,subject,created) VALUES(NEW.tester,'official-result-finalized',NEW.id,NEW.created); END;
--> statement-breakpoint
CREATE TRIGGER waitlist_join_audit AFTER INSERT ON waitlists BEGIN INSERT INTO audit(actor,action,subject,created) VALUES(NEW.user,'waitlist-interest',NEW.mode||'/'||NEW.region,NEW.created); END;
