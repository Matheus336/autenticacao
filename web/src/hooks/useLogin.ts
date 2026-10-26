import { useState } from "react";
import type { AuthSession, TotpSetup } from "../types/auth";
import { login } from "../api/auth";
import { getErrorMessage } from "../utils/errors";
import { MESSAGES, resolveLoginResponse } from "./loginFlow";

export type Challenge = "totp" | "setup" | null;

export function useLogin(onAuthenticated: (session: AuthSession) => void) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<Challenge>(null);
  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await login({
        email,
        password,
        ...(challenge ? { code } : {}),
      });
      const outcome = resolveLoginResponse(response);

      switch (outcome.kind) {
        case "totp":
          setChallenge("totp");
          setMessage(MESSAGES.totp);
          break;
        case "setup":
          setChallenge("setup");
          setSetup(outcome.setup);
          setMessage(MESSAGES.setup);
          break;
        case "authenticated":
          setChallenge(null);
          setSetup(null);
          setMessage(MESSAGES.welcome(outcome.session.user.fullName));
          setPassword("");
          setCode("");
          onAuthenticated(outcome.session);
          break;
      }
    } catch (e: unknown) {
      setError(getErrorMessage(e, MESSAGES.loginError));
    } finally {
      setLoading(false);
    }
  }

  function cancel() {
    setChallenge(null);
    setSetup(null);
    setCode("");
    setMessage("");
    setError("");
  }

  return {
    email,
    setEmail,
    password,
    setPassword,
    code,
    setCode,
    challenge,
    setup,
    message,
    error,
    loading,
    submit,
    cancel,
  };
}
