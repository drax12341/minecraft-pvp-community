CREATE TABLE mode_settings(id TEXT PRIMARY KEY,name TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1,icon TEXT NOT NULL DEFAULT '⚔️',rules TEXT NOT NULL DEFAULT '[]',testing_server TEXT NOT NULL DEFAULT '',cooldown_hours INTEGER NOT NULL DEFAULT 720,capacity INTEGER NOT NULL DEFAULT 20,score_limit INTEGER NOT NULL DEFAULT 60,created TEXT NOT NULL,updated TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE region_settings(id TEXT PRIMARY KEY,name TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1);
--> statement-breakpoint
CREATE TABLE platform_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL,actor TEXT NOT NULL,updated TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE tester_sessions(id TEXT PRIMARY KEY,user TEXT NOT NULL,mode TEXT NOT NULL,region TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('available','paused','offline')),started TEXT NOT NULL,updated TEXT NOT NULL,ended TEXT);
--> statement-breakpoint
CREATE UNIQUE INDEX one_tester_session ON tester_sessions(user,mode,region) WHERE ended IS NULL;
--> statement-breakpoint
CREATE TABLE test_lifecycle(test_id TEXT PRIMARY KEY REFERENCES queue(id),state TEXT NOT NULL CHECK(state IN ('CREATED','AWAITING_PLAYER','PLAYER_READY','IN_PROGRESS','AWAITING_RESULT','RESULT_PENDING_CONFIRMATION','COMPLETED','CANCELLED','ABSENT','DISPUTED','ARCHIVED')),version INTEGER NOT NULL DEFAULT 0,score TEXT,reason TEXT,deadline TEXT NOT NULL,updated TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE match_events(id TEXT PRIMARY KEY,test_id TEXT NOT NULL REFERENCES queue(id),actor TEXT NOT NULL,action TEXT NOT NULL,detail TEXT NOT NULL,created TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE staff_action_drafts(id TEXT PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,payload TEXT NOT NULL,expires TEXT NOT NULL,completed TEXT);
--> statement-breakpoint
CREATE TABLE player_settings(user TEXT PRIMARY KEY,region TEXT,public_profile INTEGER NOT NULL DEFAULT 1);
--> statement-breakpoint
CREATE TABLE player_restrictions(user TEXT NOT NULL,mode TEXT NOT NULL,until_at TEXT NOT NULL,reason TEXT NOT NULL,actor TEXT NOT NULL,created TEXT NOT NULL,PRIMARY KEY(user,mode));
--> statement-breakpoint
CREATE TABLE tester_quotas(user TEXT NOT NULL,mode TEXT NOT NULL,target INTEGER NOT NULL,actor TEXT NOT NULL,updated TEXT NOT NULL,PRIMARY KEY(user,mode));
--> statement-breakpoint
CREATE TABLE setup_runs(guild TEXT PRIMARY KEY,stage INTEGER NOT NULL DEFAULT 1,settings TEXT NOT NULL DEFAULT '{}',updated TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE guild_resources(key TEXT PRIMARY KEY,discord_id TEXT NOT NULL,kind TEXT NOT NULL,updated TEXT NOT NULL);
--> statement-breakpoint
CREATE TRIGGER managed_assignment_guard BEFORE UPDATE OF status ON queue WHEN NEW.status='claimed' AND OLD.status='waiting' AND EXISTS(SELECT 1 FROM tester_sessions WHERE mode=NEW.mode AND region=NEW.region AND ended IS NULL) AND NOT EXISTS(SELECT 1 FROM tester_sessions WHERE user=NEW.tester AND mode=NEW.mode AND region=NEW.region AND status='available' AND ended IS NULL) BEGIN SELECT RAISE(ABORT,'Tester is not available in this managed session'); END;
--> statement-breakpoint
CREATE TRIGGER managed_result_state BEFORE INSERT ON results WHEN EXISTS(SELECT 1 FROM test_lifecycle WHERE test_id=NEW.id AND state NOT IN ('AWAITING_RESULT','RESULT_PENDING_CONFIRMATION')) BEGIN SELECT RAISE(ABORT,'Managed test is not awaiting an official result'); END;
