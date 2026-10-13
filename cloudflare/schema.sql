CREATE TABLE IF NOT EXISTS app_records (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS app_records_scope_idx ON app_records(json_extract(key,'$[0]'));
CREATE TABLE IF NOT EXISTS app_lease (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  owner TEXT NOT NULL,
  expires INTEGER NOT NULL
);
INSERT OR IGNORE INTO app_lease (id, owner, expires) VALUES (1, '', 0);
CREATE TABLE IF NOT EXISTS app_collection_lease (
 id INTEGER PRIMARY KEY CHECK (id = 1),
 owner TEXT NOT NULL,
 expires INTEGER NOT NULL
);
INSERT OR IGNORE INTO app_collection_lease(id,owner,expires) VALUES(1,'',0);
CREATE TABLE IF NOT EXISTS app_job_lease (id INTEGER PRIMARY KEY CHECK(id=1),owner TEXT NOT NULL,expires INTEGER NOT NULL);
INSERT OR IGNORE INTO app_job_lease(id,owner,expires) VALUES(1,'',0);
CREATE TABLE IF NOT EXISTS scheduler_health (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  checked_at INTEGER NOT NULL,
  status TEXT NOT NULL
);
