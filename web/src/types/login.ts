import type { AuthSession, AuthUser, TotpSetup } from "./auth";

interface LoginResponse {
  authenticated?: boolean;
  requiresTotp?: boolean;
  requiresTotpSetup?: boolean;
  totpSetup?: TotpSetup;
  user?: AuthUser;
  authenticatedAt?: string;
  expiresAt?: string;
}

interface LoginProps {
  onRegister: () => void;
  onAuthenticated: (session: AuthSession) => void;
}

export {
  type LoginResponse,
  type LoginProps,
};
