import { authRequest } from "./authApi";
import type { LoginResponse } from "../types/login";

export type LoginPayload = {
  email: string;
  password: string;
  code?: string;
};

export function login(payload: LoginPayload) {
  return authRequest<LoginResponse>("/auth/login", payload);
}
