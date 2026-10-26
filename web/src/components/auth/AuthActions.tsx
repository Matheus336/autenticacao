type Props = {
  loading: boolean;
  submitLabel: string;
  secondaryLabel: string;
  onSecondary: () => void;
};

export default function AuthActions({
  loading,
  submitLabel,
  secondaryLabel,
  onSecondary,
}: Props) {
  return (
    <div className="auth-actions">
      <button type="submit" disabled={loading}>
        {loading ? "Aguarde..." : submitLabel}
      </button>
      <button
        className="auth-secondary-button"
        type="button"
        onClick={onSecondary}
      >
        {secondaryLabel}
      </button>
    </div>
  );
}
