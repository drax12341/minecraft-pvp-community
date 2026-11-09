CREATE TABLE high_tests(id TEXT PRIMARY KEY,user TEXT NOT NULL,kind TEXT NOT NULL DEFAULT 'player',mode TEXT NOT NULL,region TEXT NOT NULL,target TEXT NOT NULL,availability TEXT NOT NULL,experience TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'pending',phase INTEGER NOT NULL DEFAULT 1,tester TEXT,channel TEXT UNIQUE,reason TEXT,result_id TEXT,created TEXT NOT NULL,updated TEXT NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX one_active_high_test ON high_tests(user,kind,mode) WHERE status IN ('pending','claimed');
--> statement-breakpoint
CREATE TABLE high_test_sets(id TEXT PRIMARY KEY,test_id TEXT NOT NULL,phase INTEGER NOT NULL,opponent TEXT NOT NULL,opponent_tier TEXT NOT NULL,wins INTEGER,losses INTEGER,evidence TEXT,actor TEXT NOT NULL,updated TEXT NOT NULL,UNIQUE(test_id,phase,opponent));
--> statement-breakpoint
CREATE TABLE test_restrictions(user TEXT NOT NULL,mode TEXT NOT NULL,until_at TEXT NOT NULL,reason TEXT NOT NULL,test_id TEXT NOT NULL,PRIMARY KEY(user,mode));
--> statement-breakpoint
CREATE TABLE high_test_events(id TEXT PRIMARY KEY,test_id TEXT NOT NULL,actor TEXT NOT NULL,action TEXT NOT NULL,note TEXT NOT NULL,created TEXT NOT NULL);
--> statement-breakpoint
ALTER TABLE high_tests ADD COLUMN room_lock TEXT;
