import { toPublicUser } from "../mappers/user.mapper";
import {
  DuplicateUserError,
  findUserByEmail,
  insertUser,
  promotePendingTotpSecret,
} from "../repositories/user.repository";
import type { UserRecord } from "../types/user";
import type {
  Credentials,
  RegisterInput,
} from "../validators/auth.validators";
import { HttpError } from "../utils/errors";
import {
  assertAuthAttemptAllowed,
  clearAuthFailures,
  recordAuthFailure,
} from "./auth-attempt.service";
import {
  createTotpSetup,
  generateTotpSecret,
  verifyTotp,
} from "./totp.service";

async function authenticate(
  email: string,
  password: string,
  clientIp: string | null,
  action: "login-password" | "totp-activation-password",
): Promise<UserRecord> {
  const context = { email, clientIp };
  assertAuthAttemptAllowed(context, action);
  const user = findUserByEmail(email);

  if (!user || !(await Bun.password.verify(password, user.password_hash))) {
    recordAuthFailure(context, action);
    throw new HttpError(401, "E-mail ou senha incorretos.");
  }

  clearAuthFailures(context, action);
  return user;
}

function assertTotpCode(
  email: string,
  clientIp: string | null,
  action: "login-totp" | "totp-activation-code",
  secret: string,
  code: string,
  invalidMessage: string,
): void {
  const context = { email, clientIp };
  assertAuthAttemptAllowed(context, action);
  if (!verifyTotp(secret, code)) {
    recordAuthFailure(context, action);
    throw new HttpError(401, invalidMessage);
  }
  clearAuthFailures(context, action);
}

export async function registerUser(input: RegisterInput) {
  const secret = generateTotpSecret();
  const passwordHash = await Bun.password.hash(input.password);

  try {
    insertUser({
      fullName: input.fullName,
      ra: input.ra,
      email: input.email,
      passwordHash,
      pendingTotpSecret: secret,
    });
  } catch (error: unknown) {
    if (error instanceof DuplicateUserError) {
      throw new HttpError(409, "Este RA ou e-mail já está cadastrado.");
    }
    throw error;
  }

  return { registered: true, totpSetup: createTotpSetup(input.email, secret) };
}

export async function activateTotp(
  { email, password, code }: Credentials,
  clientIp: string | null,
) {
  const user = await authenticate(
    email,
    password,
    clientIp,
    "totp-activation-password",
  );

  if (user.totp_secret) {
    throw new HttpError(409, "Autenticação multifator já ativada.");
  }

  assertTotpCode(
    email,
    clientIp,
    "totp-activation-code",
    user.pending_totp_secret,
    code,
    "Código inválido ou expirado.",
  );

  promotePendingTotpSecret(user.id);
  return { activated: true, user: toPublicUser(user) };
}

export async function loginUser(
  { email, password, code }: Credentials,
  clientIp: string | null,
) {
  const user = await authenticate(email, password, clientIp, "login-password");

  if (user.totp_secret) {
    if (!code) return { requiresTotp: true };
    assertTotpCode(
      email,
      clientIp,
      "login-totp",
      user.totp_secret,
      code,
      "Código de autenticação inválido ou expirado.",
    );
  } else {
    if (!code) {
      return {
        requiresTotpSetup: true,
        totpSetup: createTotpSetup(user.email, user.pending_totp_secret),
      };
    }

    assertTotpCode(
      email,
      clientIp,
      "login-totp",
      user.pending_totp_secret,
      code,
      "Código de autenticação inválido ou expirado.",
    );
    promotePendingTotpSecret(user.id);
  }

  return { authenticated: true, user: toPublicUser(user), userId: user.id };
}
