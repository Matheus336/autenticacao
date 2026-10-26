import { createHash, randomBytes } from "crypto";
import {
  deleteSession,
  findSession,
  insertSession,
} from "../repositories/session.repository";
import { config } from "../config";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createUserSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  const createdAt = Date.now();
  const expiresAt = createdAt + config.sessionDurationMs;

  insertSession(hashToken(token), userId, createdAt, expiresAt);

  return {
    token,
    createdAt: new Date(createdAt).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
  };
}

export function getUserSession(token: string) {
  const session = findSession(hashToken(token));
  if (!session) return null;

  if (session.expires_at <= Date.now()) {
    deleteSession(session.token_hash);
    return null;
  }

  return {
    user: session.user,
    createdAt: new Date(session.created_at).toISOString(),
    expiresAt: new Date(session.expires_at).toISOString(),
  };
}

export function revokeUserSession(token: string): void {
  deleteSession(hashToken(token));
}
