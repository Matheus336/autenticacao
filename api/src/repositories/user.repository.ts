import { database } from "../database/connection";
import type { UserRecord } from "../types/user";

export class DuplicateUserError extends Error {}

type NewUser = {
  fullName: string;
  ra: string;
  email: string;
  passwordHash: string;
  pendingTotpSecret: string;
};

export function findUserByEmail(email: string): UserRecord | null {
  return database
    .query("SELECT * FROM users WHERE email = ?")
    .get(email) as UserRecord | null;
}

export function insertUser(user: NewUser): void {
  try {
    database
      .query(
        `INSERT INTO users
         (full_name, ra, email, password_hash, pending_totp_secret)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        user.fullName,
        user.ra,
        user.email,
        user.passwordHash,
        user.pendingTotpSecret,
      );
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message.includes("UNIQUE constraint failed")
    ) {
      throw new DuplicateUserError();
    }

    throw error;
  }
}

export function updateUserDocument(userId: number, document: string): void {
  try {
    database
      .query("UPDATE users SET document = ? WHERE id = ?")
      .run(document, userId);
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message.includes("UNIQUE constraint failed")
    ) {
      throw new DuplicateUserError();
    }
    throw error;
  }
}

export function promotePendingTotpSecret(userId: number): void {
  database
    .query(
      "UPDATE users SET totp_secret = pending_totp_secret, pending_totp_secret = '' WHERE id = ?",
    )
    .run(userId);
}

export function updateUserAvatar(
  userId: number,
  data: Uint8Array,
  mime: string,
): void {
  database
    .query("UPDATE users SET avatar_data = ?, avatar_mime = ? WHERE id = ?")
    .run(data, mime, userId);
}

export function findUserAvatar(
  userId: number,
): { data: Uint8Array; mime: string } | null {
  const avatar = database
    .query(
      "SELECT avatar_data, avatar_mime FROM users WHERE id = ? AND avatar_data IS NOT NULL",
    )
    .get(userId) as
    | { avatar_data: Uint8Array; avatar_mime: string | null }
    | null;

  if (!avatar || !avatar.avatar_mime) return null;
  return { data: avatar.avatar_data, mime: avatar.avatar_mime };
}
