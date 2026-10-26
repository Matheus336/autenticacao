type Props = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
};

export default function TotpCodeField({
  value,
  onChange,
  id = "totp-code",
}: Props) {
  return (
    <div className="auth-field">
      <label htmlFor={id}>Código de autenticação</label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        pattern="[0-9]{6}"
        maxLength={6}
        value={value}
        onChange={(event) =>
          onChange(event.target.value.replace(/\D/g, "").slice(0, 6))
        }
        placeholder="000000"
        autoComplete="one-time-code"
        required
        autoFocus
      />
    </div>
  );
}
