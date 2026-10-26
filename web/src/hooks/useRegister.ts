import { useState, type FormEvent } from "react";
import {
  activateTotp,
  register,
  type RegisterPayload,
} from "../api/authApi";
import type { TotpSetup } from "../types/auth";
import { getErrorMessage } from "../utils/errors";
import { registerPasswordSchema } from "../schemas/register";

export type RegisterStep = "form" | "totp" | "done";

const INITIAL_VALUES: RegisterPayload = {
  fullName: "",
  ra: "",
  email: "",
  password: "",
};

export function useRegister() {
  const [values, setValues] = useState(INITIAL_VALUES);
  const [code, setCode] = useState("");
  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const step: RegisterStep = completed ? "done" : setup ? "totp" : "form";

  function updateField(field: keyof RegisterPayload, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (step === "form") {
        const passwordValidation = registerPasswordSchema.safeParse(
          values.password,
        );
        if (!passwordValidation.success) {
          setError(
            passwordValidation.error.issues
              .map((issue) => issue.message)
              .join(" "),
          );
          return;
        }

        const response = await register(values);
        setSetup(response.totpSetup);
        return;
      }

      await activateTotp({
        email: values.email,
        password: values.password,
        code,
      });
      setCompleted(true);
      setValues(INITIAL_VALUES);
      setCode("");
      setSetup(null);
    } catch (requestError: unknown) {
      setError(
        getErrorMessage(
          requestError,
          "Não foi possível concluir o cadastro.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  return {
    step,
    values,
    code,
    setup,
    error,
    loading,
    updateField,
    setCode,
    submit,
  };
}
