import TotpSetupPanel from "../components/totp/TotpSetup";
import CredentialsFields from "../components/login/CredencialsField";
import AuthActions from "../components/auth/AuthActions";
import AuthFeedback from "../components/auth/AuthFeedback";
import TotpCodeField from "../components/auth/TotpCodeField";
import { useLogin } from "../hooks/useLogin";
import type { LoginProps } from "../types/login";

export default function Login({ onRegister, onAuthenticated }: LoginProps) {
  const login = useLogin(onAuthenticated);
  const inChallenge = login.challenge !== null;

  return (
    <section className="auth-content">
      <h1 className="auth-title">Acesso Acadêmico Autenticado</h1>
      <form className="auth-form" onSubmit={login.submit}>
        <CredentialsFields
          email={login.email}
          password={login.password}
          disabled={inChallenge}
          onEmailChange={login.setEmail}
          onPasswordChange={login.setPassword}
        />

        {login.challenge === "setup" && login.setup && (
          <TotpSetupPanel setup={login.setup} description={login.message} />
        )}

        {inChallenge && (
          <TotpCodeField value={login.code} onChange={login.setCode} />
        )}

        <AuthFeedback error={login.error} message={login.message} />

        <AuthActions
          loading={login.loading}
          submitLabel={inChallenge ? "Confirmar código" : "Entrar"}
          secondaryLabel={inChallenge ? "Voltar" : "Cadastrar"}
          onSecondary={inChallenge ? login.cancel : onRegister}
        />
      </form>
    </section>
  );
}
