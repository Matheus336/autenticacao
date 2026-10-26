import type { PublicUser, UserRecord } from "../types/user";

export function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    fullName: user.full_name,
    ra: user.ra,
    email: user.email,
    document: user.document,
  };
}
