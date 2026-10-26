type Props = { onBackToLogin: () => void };

export default function RegistrationComplete({ onBackToLogin }: Props) {
  return (
    <section className="auth-content">
      <h1 className="auth-title">Cadastro concluído</h1>
      <div className="auth-form auth-complete">
        <p>Autenticação multifator ativada com sucesso.</p>
        <button type="button" onClick={onBackToLogin}>
          Ir para o login
        </button>
      </div>
    </section>
  );
}
