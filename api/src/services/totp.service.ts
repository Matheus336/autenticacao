import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { config } from "../config";
import type { TotpSetup } from "../types/user";
import { decodeBase32, encodeBase32 } from "../utils/base32";

export function generateTotpSecret(): string {
  return encodeBase32(randomBytes(20));
}

export function createTotpSetup(email: string, secret: string): TotpSetup {
  const label = encodeURIComponent(`${config.totpIssuer}:${email}`);
  const issuer = encodeURIComponent(config.totpIssuer);
  const otpauthUrl = `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;

  return { secret, otpauthUrl };
}

function createTotpCode(secret: string, counter: number): string {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac("sha1", decodeBase32(secret))
    .update(counterBuffer)
    .digest();
  const offset = digest[digest.length - 1]! & 15;
  const binary =
    ((digest[offset]! & 127) << 24) |
    ((digest[offset + 1]! & 255) << 16) |
    ((digest[offset + 2]! & 255) << 8) |
    (digest[offset + 3]! & 255);

  return String(binary % 1_000_000).padStart(6, "0");
}

export function verifyTotp(secret: string, code: string): boolean {
  if (!secret || !/^\d{6}$/.test(code)) return false;

  const currentCounter = Math.floor(Date.now() / 30_000);
  const supplied = Buffer.from(code);

  for (let offset = -1; offset <= 1; offset += 1) {
    const expected = Buffer.from(createTotpCode(secret, currentCounter + offset));
    if (timingSafeEqual(supplied, expected)) return true;
  }

  return false;
}
