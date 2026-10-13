CREATE TABLE IF NOT EXISTS app_job_lease (id INTEGER PRIMARY KEY CHECK(id=1),owner TEXT NOT NULL,expires INTEGER NOT NULL);
INSERT OR IGNORE INTO app_job_lease(id,owner,expires) VALUES(1,'',0);
