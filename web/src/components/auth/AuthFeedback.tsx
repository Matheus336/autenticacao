type Props = { error: string; message: string };

export default function AuthFeedback({ error, message }: Props) {
  return (
    <>
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="auth-message" role="status">
          {message}
        </p>
      )}
    </>
  );
}
