CREATE TABLE queue_closures(mode TEXT NOT NULL,region TEXT NOT NULL,reason TEXT NOT NULL,ended_at TEXT NOT NULL,actor TEXT NOT NULL,PRIMARY KEY(mode,region));
--> statement-breakpoint
CREATE TRIGGER queue_closed_record AFTER UPDATE OF status ON sessions WHEN NEW.status='closed' AND OLD.status<>'closed' BEGIN INSERT INTO queue_closures VALUES(NEW.mode,NEW.region,'Queue manually ended by command',NEW.updated,NEW.actor) ON CONFLICT(mode,region) DO UPDATE SET reason=excluded.reason,ended_at=excluded.ended_at,actor=excluded.actor; END;
--> statement-breakpoint
CREATE TRIGGER queue_initial_closed_record AFTER INSERT ON sessions WHEN NEW.status='closed' BEGIN INSERT INTO queue_closures VALUES(NEW.mode,NEW.region,'Queue manually ended by command',NEW.updated,NEW.actor) ON CONFLICT(mode,region) DO UPDATE SET reason=excluded.reason,ended_at=excluded.ended_at,actor=excluded.actor; END;
