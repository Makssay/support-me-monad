CREATE TABLE IF NOT EXISTS app_collection_lease (id INTEGER PRIMARY KEY CHECK (id = 1),owner TEXT NOT NULL,expires INTEGER NOT NULL);
INSERT OR IGNORE INTO app_collection_lease(id,owner,expires) VALUES(1,'',0);
