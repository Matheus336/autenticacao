import { z } from "zod";

function isValidCpf(document: string): boolean {
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

export const cpfSchema = z
  .string()
  .refine(isValidCpf, "Informe um CPF válido.");
