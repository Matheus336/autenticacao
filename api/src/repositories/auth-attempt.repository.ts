import { database } from "../database/connection";

export type AuthAttemptAction =
  | "login-password"
  | "login-totp"
  | "totp-activation-password"
  | "totp-activation-code";

export type AuthAttemptScope = "email" | "ip";

type AuthAttemptRecord = {
  failed_attempts: number;
  window_started_at: number;
  locked_until: number;
};

export function findAuthAttempt(
  scope: AuthAttemptScope,
  keyHash: string,
  action: AuthAttemptAction,
): AuthAttemptRecord | null {
  return database
    .query(
      `SELECT failed_attempts, window_started_at, locked_until
       FROM auth_attempts WHERE scope = ? AND key_hash = ? AND action = ?`,
    )
    .get(scope, keyHash, action) as AuthAttemptRecord | null;
}

export function recordAuthAttemptFailure(
  scope: AuthAttemptScope,
  keyHash: string,
  action: AuthAttemptAction,
  now: number,
  windowMs: number,
  lockoutMs: number,
  maxAttempts: number,
): void {
  database
    .query(
      `DELETE FROM auth_attempts
       WHERE window_started_at + ? <= ? AND locked_until <= ?`,
    )
    .run(windowMs, now, now);

  const existing = findAuthAttempt(scope, keyHash, action);
  const isExpired =
    !existing || now - existing.window_started_at >= windowMs;
  const failedAttempts = isExpired ? 1 : existing.failed_attempts + 1;
  const windowStartedAt = isExpired ? now : existing.window_started_at;
  const lockedUntil =
    failedAttempts >= maxAttempts ? now + lockoutMs : 0;

  database
    .query(
      `INSERT INTO auth_attempts
       (scope, key_hash, action, failed_attempts, window_started_at, locked_until)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(scope, key_hash, action) DO UPDATE SET
         failed_attempts = excluded.failed_attempts,
         window_started_at = excluded.window_started_at,
         locked_until = excluded.locked_until`,
    )
    .run(
      scope,
      keyHash,
      action,
      failedAttempts,
      windowStartedAt,
      lockedUntil,
    );
}

export function clearAuthAttempt(
  scope: AuthAttemptScope,
  keyHash: string,
  action: AuthAttemptAction,
): void {
  database
    .query(
      "DELETE FROM auth_attempts WHERE scope = ? AND key_hash = ? AND action = ?",
    )
    .run(scope, keyHash, action);
}
