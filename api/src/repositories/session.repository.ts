import { database } from "../database/connection";
import type { UserRecord } from "../types/user";

export type SessionRecord = {
  token_hash: string;
  created_at: number;
  expires_at: number;
  user: UserRecord;
};

export function insertSession(
  tokenHash: string,
  userId: number,
  createdAt: number,
  expiresAt: number,
): void {
  database
    .query(
      "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
    )
    .run(tokenHash, userId, createdAt, expiresAt);
}

export function findSession(tokenHash: string): SessionRecord | null {
  const row = database
    .query(
      `SELECT
        sessions.token_hash, sessions.created_at, sessions.expires_at,
        users.id, users.full_name, users.ra, users.email, users.password_hash,
        users.totp_secret, users.pending_totp_secret, users.document,
        users.avatar_data, users.avatar_mime
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = ?`,
    )
    .get(tokenHash) as
    | (Omit<SessionRecord, "user"> & UserRecord)
    | null;

  if (!row) return null;

  const {
    token_hash,
    created_at,
    expires_at,
    id,
    full_name,
    ra,
    email,
    password_hash,
    totp_secret,
    pending_totp_secret,
    document,
    avatar_data,
    avatar_mime,
  } = row;

  return {
    token_hash,
    created_at,
    expires_at,
    user: {
      id,
      full_name,
      ra,
      email,
      password_hash,
      totp_secret,
      pending_totp_secret,
      document,
      avatar_data,
      avatar_mime,
    },
  };
}

export function deleteSession(tokenHash: string): void {
  database.query("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
}
