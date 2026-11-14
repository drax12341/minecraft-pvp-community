CREATE TABLE web_oauth_states(state_hash TEXT PRIMARY KEY,verifier TEXT NOT NULL,expires TEXT NOT NULL,return_to TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE web_sessions(token_hash TEXT PRIMARY KEY,user TEXT NOT NULL,username TEXT NOT NULL,avatar TEXT,csrf_hash TEXT NOT NULL,expires TEXT NOT NULL,created TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX web_sessions_expiry ON web_sessions(expires);
--> statement-breakpoint
CREATE TABLE web_rate_limits(key TEXT PRIMARY KEY,window INTEGER NOT NULL,hits INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE published_updates(id TEXT PRIMARY KEY,title TEXT NOT NULL,category TEXT NOT NULL,summary TEXT NOT NULL,body TEXT NOT NULL,version TEXT NOT NULL,author TEXT NOT NULL,published TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE account_aliases(uuid TEXT NOT NULL,name TEXT NOT NULL,first_seen TEXT NOT NULL,last_seen TEXT NOT NULL,PRIMARY KEY(uuid,name));
--> statement-breakpoint
CREATE INDEX aliases_name_search ON account_aliases(lower(name));
--> statement-breakpoint
CREATE INDEX accounts_name_search ON accounts(lower(name));
--> statement-breakpoint
CREATE TRIGGER account_alias_insert AFTER INSERT ON accounts BEGIN INSERT OR IGNORE INTO account_aliases VALUES(NEW.uuid,NEW.name,COALESCE(NEW.verified_at,strftime('%Y-%m-%dT%H:%M:%fZ','now')),COALESCE(NEW.verified_at,strftime('%Y-%m-%dT%H:%M:%fZ','now'))); END;
--> statement-breakpoint
CREATE TRIGGER account_alias_update AFTER UPDATE OF name ON accounts BEGIN INSERT INTO account_aliases SELECT OLD.uuid,OLD.name,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE NOT EXISTS(SELECT 1 FROM account_aliases WHERE uuid=OLD.uuid AND name=OLD.name); INSERT INTO account_aliases VALUES(NEW.uuid,NEW.name,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')) ON CONFLICT(uuid,name) DO UPDATE SET last_seen=excluded.last_seen; END;
--> statement-breakpoint
CREATE INDEX result_public_activity ON results(created,mode,region,record_type);
--> statement-breakpoint
CREATE TABLE staff_public_profiles(user TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,display_name TEXT NOT NULL,avatar TEXT,updated TEXT NOT NULL);
