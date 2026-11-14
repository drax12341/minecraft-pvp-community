CREATE TABLE tester_active_intervals(id INTEGER PRIMARY KEY AUTOINCREMENT,session_id TEXT NOT NULL REFERENCES tester_sessions(id),started TEXT NOT NULL,ended TEXT);
--> statement-breakpoint
CREATE TRIGGER tester_interval_open AFTER INSERT ON tester_sessions WHEN NEW.status='available' AND NEW.ended IS NULL BEGIN INSERT INTO tester_active_intervals(session_id,started) VALUES(NEW.id,NEW.started); END;
--> statement-breakpoint
CREATE TRIGGER tester_interval_pause AFTER UPDATE ON tester_sessions WHEN OLD.status='available' AND (NEW.status<>'available' OR NEW.ended IS NOT NULL) BEGIN UPDATE tester_active_intervals SET ended=NEW.updated WHERE session_id=NEW.id AND ended IS NULL; END;
--> statement-breakpoint
CREATE TRIGGER tester_interval_resume AFTER UPDATE ON tester_sessions WHEN OLD.status<>'available' AND NEW.status='available' AND NEW.ended IS NULL BEGIN INSERT INTO tester_active_intervals(session_id,started) VALUES(NEW.id,NEW.updated); END;
