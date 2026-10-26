export type UserRecord = {
  id: number;
  full_name: string;
  ra: string;
  email: string;
  password_hash: string;
  totp_secret: string | null;
  pending_totp_secret: string;
  document: string | null;
  avatar_data: Uint8Array | null;
  avatar_mime: string | null;
};

export type PublicUser = {
  id: number;
  fullName: string;
  ra: string;
  email: string;
  document: string | null;
};

export type TotpSetup = {
  secret: string;
  otpauthUrl: string;
};
