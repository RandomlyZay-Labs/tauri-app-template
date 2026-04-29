CREATE TABLE IF NOT EXISTS jobs (
    id          TEXT    PRIMARY KEY NOT NULL,
    kind        TEXT    NOT NULL,
    status      TEXT    NOT NULL DEFAULT 'pending',
    progress    REAL,
    message     TEXT,
    metadata    TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
