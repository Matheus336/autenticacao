import type { Database } from "bun:sqlite";

export function initializeSchema(database: Database) {
  database.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      ra TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      totp_secret TEXT,
      pending_totp_secret TEXT NOT NULL,
      document TEXT,
      avatar_data BLOB,
      avatar_mime TEXT
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
    CREATE TABLE IF NOT EXISTS auth_attempts (
      scope TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      action TEXT NOT NULL,
      failed_attempts INTEGER NOT NULL,
      window_started_at INTEGER NOT NULL,
      locked_until INTEGER NOT NULL,
      PRIMARY KEY (scope, key_hash, action)
    );
    CREATE INDEX IF NOT EXISTS auth_attempts_window_idx
    ON auth_attempts(window_started_at);
  `);

  const columns = database
    .query("PRAGMA table_info(users)")
    .all() as Array<{ name: string }>;
  const existingColumns = new Set(columns.map((column) => column.name));

  if (!existingColumns.has("document")) {
    database.exec("ALTER TABLE users ADD COLUMN document TEXT");
  }
  if (!existingColumns.has("avatar_data")) {
    database.exec("ALTER TABLE users ADD COLUMN avatar_data BLOB");
  }
  if (!existingColumns.has("avatar_mime")) {
    database.exec("ALTER TABLE users ADD COLUMN avatar_mime TEXT");
  }

  database.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_document_unique_idx
    ON users(document) WHERE document IS NOT NULL;
  `);
}
