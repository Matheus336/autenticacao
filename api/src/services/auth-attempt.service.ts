import { createHash } from "crypto";
import { config } from "../config";
import {
  clearAuthAttempt,
  findAuthAttempt,
  recordAuthAttemptFailure,
  type AuthAttemptAction,
  type AuthAttemptScope,
} from "../repositories/auth-attempt.repository";
import { HttpError } from "../utils/errors";

type AuthAttemptContext = {
  email: string;
  clientIp: string | null;
};

function hashKey(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function getKeys(
  context: AuthAttemptContext,
): Array<{ scope: AuthAttemptScope; keyHash: string }> {
  const keys: Array<{ scope: AuthAttemptScope; keyHash: string }> = [
    { scope: "email" as const, keyHash: hashKey(context.email) },
  ];
  if (context.clientIp) {
    keys.push({ scope: "ip", keyHash: hashKey(context.clientIp) });
  }
  return keys;
}

function getMaxAttempts(scope: AuthAttemptScope): number {
  return scope === "email"
    ? config.maxFailedAuthAttempts
    : config.maxFailedAuthAttemptsPerIp;
}

export function assertAuthAttemptAllowed(
  context: AuthAttemptContext,
  action: AuthAttemptAction,
): void {
  const now = Date.now();

  for (const { scope, keyHash } of getKeys(context)) {
    const attempt = findAuthAttempt(scope, keyHash, action);
    if (!attempt) continue;

    const windowExpiresAt =
      attempt.window_started_at + config.authAttemptWindowMs;
    const retryAt =
      attempt.locked_until > now ? attempt.locked_until : windowExpiresAt;
    if (attempt.failed_attempts >= getMaxAttempts(scope) && retryAt > now) {
      const retryAfterSeconds = Math.ceil((retryAt - now) / 1000);
      throw new HttpError(
        429,
        `Muitas tentativas de autenticação. Tente novamente em ${retryAfterSeconds} segundos.`,
        retryAfterSeconds,
      );
    }
  }
}

export function recordAuthFailure(
  context: AuthAttemptContext,
  action: AuthAttemptAction,
): void {
  const now = Date.now();
  for (const { scope, keyHash } of getKeys(context)) {
    recordAuthAttemptFailure(
      scope,
      keyHash,
      action,
      now,
      config.authAttemptWindowMs,
      config.authLockoutDurationMs,
      getMaxAttempts(scope),
    );
  }
}

export function clearAuthFailures(
  context: AuthAttemptContext,
  action: AuthAttemptAction,
): void {
  for (const { scope, keyHash } of getKeys(context)) {
    clearAuthAttempt(scope, keyHash, action);
  }
}
