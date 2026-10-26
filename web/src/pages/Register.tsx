import AuthActions from "../components/auth/AuthActions";
import AuthFeedback from "../components/auth/AuthFeedback";
import TotpCodeField from "../components/auth/TotpCodeField";
import RegistrationComplete from "../components/register/RegistrationComplete";
import RegistrationFields from "../components/register/RegistrationFields";
import TotpSetupPanel from "../components/totp/TotpSetup";
import { useRegister } from "../hooks/useRegister";
import type { RegistrationProps } from "../types/registration";

const SETUP_DESCRIPTION =
  "O cadastro foi criado. A ativação é opcional agora, mas será obrigatória no primeiro login se você pular esta etapa.";

export default function Register({ onBackToLogin }: RegistrationProps) {
  const registration = useRegister();

  if (registration.step === "done") {
    return <RegistrationComplete onBackToLogin={onBackToLogin} />;
  }

  const setup = registration.setup;
  const inTotpStep = registration.step === "totp" && setup !== null;

  return (
    <section className="auth-content">
      <h1 className="auth-title">
        {inTotpStep ? "Ativar autenticação multifator" : "Cadastro acadêmico"}
      </h1>
      <form className="auth-form" onSubmit={registration.submit}>
        {inTotpStep ? (
          <>
            <TotpSetupPanel
              setup={setup}
              description={SETUP_DESCRIPTION}
            />
            <TotpCodeField
              id="register-totp-code"
              value={registration.code}
              onChange={registration.setCode}
            />
          </>
        ) : (
          <RegistrationFields
            values={registration.values}
            onChange={registration.updateField}
          />
        )}

        <AuthFeedback error={registration.error} message="" />

        <AuthActions
          loading={registration.loading}
          submitLabel={inTotpStep ? "Ativar e concluir" : "Criar cadastro"}
          secondaryLabel={inTotpStep ? "Fazer isso depois" : "Voltar ao login"}
          onSecondary={onBackToLogin}
        />
      </form>
    </section>
  );
}
