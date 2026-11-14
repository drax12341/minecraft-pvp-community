ALTER TABLE results ADD COLUMN record_type TEXT NOT NULL DEFAULT 'test' CHECK(record_type IN ('test','adjustment','reset'));
--> statement-breakpoint
ALTER TABLE results ADD COLUMN adjustment_reason TEXT;
--> statement-breakpoint
ALTER TABLE results ADD COLUMN previous_id TEXT REFERENCES results(id);
--> statement-breakpoint
CREATE VIEW effective_placements AS SELECT r.* FROM results r WHERE r.record_type<>'reset' AND NOT EXISTS(SELECT 1 FROM revoked v WHERE v.result_id=r.id) AND NOT EXISTS(SELECT 1 FROM results newer WHERE newer.uuid=r.uuid AND newer.mode=r.mode AND newer.sequence>r.sequence AND NOT EXISTS(SELECT 1 FROM revoked v WHERE v.result_id=newer.id));
--> statement-breakpoint
DROP TRIGGER finalized_result_audit;
--> statement-breakpoint
CREATE TRIGGER finalized_result_audit AFTER INSERT ON results WHEN NEW.record_type='test' BEGIN INSERT INTO audit(actor,action,subject,created) VALUES(NEW.tester,'official-result-finalized',NEW.id,NEW.created); END;
