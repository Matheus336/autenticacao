export interface TotpSetup {
  secret: string;
  otpauthUrl: string;
}

export interface AuthUser {
  id: number;
  fullName: string;
  ra: string;
  email: string;
  document: string | null;
}

export interface AuthSession {
  user: AuthUser;
  authenticatedAt: string;
  expiresAt: string;
}
