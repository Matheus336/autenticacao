import type { RegistrationResponse } from "../types/registration";

export const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export async function authRequest<T>(
  path: string,
  body: object,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data: unknown = await response.json();

  if (!response.ok) {
    const apiError =
      typeof data === "object" && data !== null && "error" in data
        ? data.error
        : null;
    const message =
      typeof apiError === "string"
        ? apiError
        : `Erro do servidor: ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

export type RegisterPayload = {
  fullName: string;
  ra: string;
  email: string;
  password: string;
};

export type ActivateTotpPayload = {
  email: string;
  password: string;
  code: string;
};

export function register(payload: RegisterPayload) {
  return authRequest<RegistrationResponse>("/auth/register", payload);
}

export function activateTotp(payload: ActivateTotpPayload) {
  return authRequest<unknown>("/auth/totp/activate", payload);
}
