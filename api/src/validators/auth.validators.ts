import { HttpError } from "../utils/errors";
import { isRecord, rawString, stringValue } from "../utils/guards";

export type RegisterInput = {
  fullName: string;
  ra: string;
  email: string;
  password: string;
};

export type Credentials = {
  email: string;
  password: string;
  code: string;
};

export function isValidCpf(document: string): boolean {
  if (!/^\d{11}$/.test(document) || /^(\d)\1{10}$/.test(document)) {
    return false;
  }

  const digits = [...document].map(Number);
  const calculateDigit = (length: number): number => {
    const sum = digits
      .slice(0, length)
      .reduce((total, digit, index) => total + digit * (length + 1 - index), 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return (
    calculateDigit(9) === digits[9] && calculateDigit(10) === digits[10]
  );
}

export function parseRegisterBody(body: unknown): RegisterInput {
  if (!isRecord(body)) {
    throw new HttpError(400, "Dados do cadastro inválidos.");
  }

  const fullName = stringValue(body.fullName);
  const ra = stringValue(body.ra);
  const email = stringValue(body.email).toLowerCase();
  const password = rawString(body.password);

  if (
    fullName.length < 3 ||
    fullName.length > 120 ||
    ra.length < 1 ||
    ra.length > 40 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    password.length < 8 ||
    password.length > 128 ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/\d/.test(password)
  ) {
    throw new HttpError(
      400,
      "Informe nome completo, RA e e-mail válido. A senha deve ter entre 8 e 128 caracteres, uma letra maiúscula, uma letra minúscula e um número.",
    );
  }

  return { fullName, ra, email, password };
}

export function parseCpfBody(body: unknown): string {
  if (!isRecord(body)) {
    throw new HttpError(400, "Informe um CPF válido.");
  }

  const document = rawString(body.document).replace(/\D/g, "");
  if (!isValidCpf(document)) {
    throw new HttpError(400, "Informe um CPF válido.");
  }

  return document;
}

export function parseCredentials(
  body: unknown,
  invalidMessage: string,
): Credentials {
  if (!isRecord(body)) {
    throw new HttpError(400, invalidMessage);
  }

  return {
    email: stringValue(body.email).toLowerCase(),
    password: rawString(body.password),
    code: stringValue(body.code),
  };
}
