CREATE INDEX IF NOT EXISTS app_records_scope_idx ON app_records(json_extract(key,'$[0]'));
