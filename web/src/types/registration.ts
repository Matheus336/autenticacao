import type { TotpSetup } from "./auth";

interface RegistrationResponse {
  totpSetup: TotpSetup;
}

interface RegistrationProps {
  onBackToLogin: () => void;
}

export type { RegistrationResponse, RegistrationProps, TotpSetup };
