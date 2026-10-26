import type { RegisterPayload } from "../../api/authApi";

type Props = {
  values: RegisterPayload;
  onChange: (field: keyof RegisterPayload, value: string) => void;
};

export default function RegistrationFields({ values, onChange }: Props) {
  return (
    <>
      <div className="auth-field">
        <label htmlFor="register-full-name">Nome completo</label>
        <input
          id="register-full-name"
          type="text"
          value={values.fullName}
          onChange={(event) => onChange("fullName", event.target.value)}
          placeholder="Digite seu nome completo"
          autoComplete="name"
          minLength={3}
          maxLength={120}
          required
        />
      </div>

      <div className="auth-field">
        <label htmlFor="register-ra">RA</label>
        <input
          id="register-ra"
          type="text"
          value={values.ra}
          onChange={(event) => onChange("ra", event.target.value)}
          placeholder="Digite seu registro acadêmico"
          required
        />
      </div>

      <div className="auth-field">
        <label htmlFor="register-email">E-mail</label>
        <input
          id="register-email"
          type="email"
          value={values.email}
          onChange={(event) => onChange("email", event.target.value)}
          placeholder="seu@email.com"
          autoComplete="email"
          required
        />
      </div>

      <div className="auth-field">
        <label htmlFor="register-password">Senha de acesso</label>
        <input
          id="register-password"
          type="password"
          value={values.password}
          onChange={(event) => onChange("password", event.target.value)}
          placeholder="Mínimo de 8 caracteres"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          required
        />
      </div>
    </>
  );
}
