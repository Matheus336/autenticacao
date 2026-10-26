import { API_BASE_URL } from "./authApi";
import type { AuthSession } from "../types/auth";

async function readError(response: Response): Promise<string> {
  try {
    const data: unknown = await response.json();
    if (
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof data.error === "string"
    ) {
      return data.error;
    }
  } catch {
    // Use the HTTP status message when the response has no JSON body.
  }

  return `Erro do servidor: ${response.status}`;
}

export async function getCurrentSession(): Promise<AuthSession | null> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    credentials: "include",
  });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as AuthSession;
}

export async function logoutSession(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) throw new Error(await readError(response));
}

export async function updateProfileDocument(document: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/auth/me/document`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ document }),
  });
  if (!response.ok) throw new Error(await readError(response));

  const result: unknown = await response.json();
  if (
    typeof result !== "object" ||
    result === null ||
    !("document" in result) ||
    typeof result.document !== "string"
  ) {
    throw new Error("Resposta inválida ao atualizar o CPF.");
  }
  return result.document;
}

export async function uploadProfilePhoto(photo: File): Promise<void> {
  const body = new FormData();
  body.set("photo", photo);

  const response = await fetch(`${API_BASE_URL}/auth/avatar`, {
    method: "POST",
    credentials: "include",
    body,
  });
  if (!response.ok) throw new Error(await readError(response));
}

export async function getProfilePhoto(): Promise<Blob | null> {
  const response = await fetch(`${API_BASE_URL}/auth/avatar`, {
    credentials: "include",
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(await readError(response));
  return response.blob();
}
