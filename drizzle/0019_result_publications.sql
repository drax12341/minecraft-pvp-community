CREATE TABLE result_publications(job_id INTEGER PRIMARY KEY REFERENCES outbox_events(id),channel TEXT NOT NULL,message TEXT NOT NULL,published_at TEXT NOT NULL,UNIQUE(channel,message));
