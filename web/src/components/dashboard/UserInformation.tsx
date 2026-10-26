import { useState, type FormEvent } from "react";
import { updateProfileDocument } from "../../api/session";
import type { AuthUser } from "../../types/auth";
import { getErrorMessage } from "../../utils/errors";
import { cpfSchema } from "../../schemas/document";

type Props = {
  user: AuthUser;
  onDocumentUpdated: (document: string) => void;
};

function formatCpf(document: string): string {
  return document.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

export default function UserInformation({
  user,
  onDocumentUpdated,
}: Props) {
  const [sensitiveDataVisible, setSensitiveDataVisible] = useState(false);
  const [editingDocument, setEditingDocument] = useState(false);
  const [document, setDocument] = useState(user.document ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const sensitiveValue = (value: string) =>
    sensitiveDataVisible ? value : "••••••••••";

  async function submitDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const normalizedDocument = document.replace(/\D/g, "");
    const validation = cpfSchema.safeParse(normalizedDocument);
    if (!validation.success) {
      setError(validation.error.issues.map((issue) => issue.message).join(" "));
      return;
    }

    setSaving(true);
    try {
      const updatedDocument = await updateProfileDocument(normalizedDocument);
      setDocument(updatedDocument);
      setEditingDocument(false);
      onDocumentUpdated(updatedDocument);
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError, "Não foi possível atualizar o CPF."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="dashboard-section">
      <div className="section-heading">
        <div>
          <p className="dashboard-eyebrow">INFORMAÇÕES</p>
          <h2>Dados da conta</h2>
        </div>
        <button
          className="dashboard-secondary-button privacy-toggle"
          type="button"
          aria-pressed={sensitiveDataVisible}
          onClick={() => setSensitiveDataVisible((visible) => !visible)}
        >
          {sensitiveDataVisible ? "Ocultar dados" : "Exibir dados"}
        </button>
      </div>

      <div className="user-info-grid">
        <article className="user-info-item">
          <span>Nome completo</span>
          <strong>{user.fullName}</strong>
        </article>
        <article className="user-info-item">
          <span>RA</span>
          <strong>{sensitiveValue(user.ra)}</strong>
        </article>
        <article className="user-info-item">
          <span>E-mail</span>
          <strong>{sensitiveValue(user.email)}</strong>
        </article>
        <article className="user-info-item document-info">
          <span>CPF</span>
          {editingDocument ? (
            <form className="document-form" onSubmit={submitDocument}>
              <label className="visually-hidden" htmlFor="profile-document">
                CPF
              </label>
              <input
                id="profile-document"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={document}
                onChange={(event) =>
                  setDocument(
                    event.target.value.replace(/\D/g, "").slice(0, 11),
                  )
                }
                placeholder="000.000.000-00"
                maxLength={11}
                disabled={saving}
                required
              />
              <div className="document-actions">
                <button type="submit" disabled={saving}>
                  {saving ? "Salvando..." : "Salvar CPF"}
                </button>
                <button
                  className="document-cancel"
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setDocument(user.document ?? "");
                    setEditingDocument(false);
                    setError("");
                  }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <>
              <strong>
                {user.document
                  ? sensitiveValue(formatCpf(user.document))
                  : "Não informado"}
              </strong>
              <button
                className="document-edit"
                type="button"
                onClick={() => {
                  setDocument(user.document ?? "");
                  setEditingDocument(true);
                  setError("");
                }}
              >
                {user.document ? "Alterar CPF" : "Adicionar CPF"}
              </button>
            </>
          )}
        </article>
      </div>
      {error && (
        <p className="dashboard-error document-error" role="alert">
          {error}
        </p>
      )}
      <p className="privacy-note">
        RA, e-mail e CPF ficam ocultos até você optar por exibi-los.
      </p>
    </section>
  );
}
