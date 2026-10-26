import { config } from "../config";

const COOKIE_NAME = "sid";

export function readSessionCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;

  const match = cookieHeader.match(/(?:^|;\s*)sid=([A-Za-z0-9_-]+)/);
  return match?.[1] ?? null;
}

export function createSessionCookie(token: string): string {
  const attributes = [
    `${COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(config.sessionDurationMs / 1000)}`,
  ];
  if (config.secureCookies) attributes.push("Secure");
  return attributes.join("; ");
}

export function clearSessionCookie(): string {
  const attributes = [
    `${COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (config.secureCookies) attributes.push("Secure");
  return attributes.join("; ");
}
