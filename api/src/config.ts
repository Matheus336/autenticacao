import { resolve } from "path";

export const config = {
  port: Number(Bun.env.PORT ?? 3000),
  dataDirectory: resolve(
    Bun.env.DATA_DIRECTORY ?? resolve(import.meta.dir, "../data"),
  ),
  totpIssuer: "Sistema Acadêmico",
  webOrigin: Bun.env.WEB_ORIGIN ?? "http://localhost:5173",
  sessionDurationMs: 8 * 60 * 60 * 1000,
  authAttemptWindowMs: 15 * 60 * 1000,
  authLockoutDurationMs: 15 * 60 * 1000,
  maxFailedAuthAttempts: 5,
  maxFailedAuthAttemptsPerIp: 20,
  secureCookies: Bun.env.NODE_ENV === "production",
};
