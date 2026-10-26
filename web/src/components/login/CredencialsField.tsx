type Props = {
  email: string;
  password: string;
  disabled: boolean;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
};

export default function CredentialsField({
  email,
  password,
  disabled,
  onEmailChange,
  onPasswordChange,
}: Props) {
  return (
    <>
      <div className="auth-field">
        <label htmlFor="login-email">E-mail acadêmico</label>
        <input
          id="login-email"
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          placeholder="seu@email.com"
          autoComplete="email"
          required
          disabled={disabled}
        />
      </div>
      <div className="auth-field">
        <label htmlFor="login-password">Senha</label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          placeholder="Digite sua senha"
          autoComplete="current-password"
          required
          disabled={disabled}
        />
      </div>
    </>
  );
}
