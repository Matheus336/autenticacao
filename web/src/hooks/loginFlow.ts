import type { AuthSession, TotpSetup } from "../types/auth";
import type { LoginResponse } from "../types/login";

export const MESSAGES = {
  totp: "Digite o código de seis dígitos do seu autenticador.",
  setup:
    "Para continuar, configure a autenticação multifator e confirme o código.",
  loginError: "Não foi possível realizar o login.",
  welcome: (name: string) => `Login realizado. Bem-vindo(a), ${name}.`,
};

export type LoginOutcome =
  | { kind: "totp" }
  | { kind: "setup"; setup: TotpSetup }
  | { kind: "authenticated"; session: AuthSession }
  | { kind: "none" };

export function resolveLoginResponse(response: LoginResponse): LoginOutcome {
  if (response.requiresTotp) {
    return { kind: "totp" };
  }
  if (response.requiresTotpSetup && response.totpSetup) {
    return { kind: "setup", setup: response.totpSetup };
  }
  if (
    response.authenticated &&
    response.user &&
    response.authenticatedAt &&
    response.expiresAt
  ) {
    return {
      kind: "authenticated",
      session: {
        user: response.user,
        authenticatedAt: response.authenticatedAt,
        expiresAt: response.expiresAt,
      },
    };
  }
  return { kind: "none" };
}
