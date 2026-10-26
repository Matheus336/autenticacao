import { useEffect, useRef, useState } from "react";
import ProfilePhoto from "../components/dashboard/ProfilePhoto";
import UserInformation from "../components/dashboard/UserInformation";
import type { AuthSession } from "../types/auth";
import "./Dashboard.css";

type Props = {
  session: AuthSession;
  onLogout: () => void;
  loggingOut: boolean;
  logoutError: string;
  onDocumentUpdated: (document: string) => void;
};

function elapsedTime(startedAt: string, now: number): string {
  const seconds = Math.max(
    0,
    Math.floor((now - new Date(startedAt).getTime()) / 1000),
  );
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [hours, minutes, remainder]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

export default function Dashboard({
  session,
  onLogout,
  loggingOut,
  logoutError,
  onDocumentUpdated,
}: Props) {
  const [now, setNow] = useState(0);
  const expirationHandled = useRef(false);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const currentTime = Date.now();
      setNow(currentTime);
      if (
        !expirationHandled.current &&
        currentTime >= new Date(session.expiresAt).getTime()
      ) {
        expirationHandled.current = true;
        onLogout();
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [onLogout, session.expiresAt]);

  const { user } = session;
  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <h2 className="dashboard-title">ÁREA DO ACADÊMICO</h2>
        </div>
        <button
          className="dashboard-logout"
          type="button"
          disabled={loggingOut}
          onClick={onLogout}
        >
          {loggingOut ? "Saindo..." : "Sair"}
        </button>
      </header>

      {logoutError && (
        <p className="dashboard-error logout-error" role="alert">
          {logoutError}
        </p>
      )}

      <section className="dashboard-profile-card">
        <ProfilePhoto fullName={user.fullName} />
        <div className="profile-intro">
          <p className="dashboard-eyebrow">BEM-VINDO</p>
          <h2>{user.fullName}</h2>
        </div>
        <div className="session-status">
          <span className="status-indicator" aria-hidden="true" />
          <span>Sessão ativa</span>
        </div>
      </section>

      <UserInformation user={user} onDocumentUpdated={onDocumentUpdated} />

      <section className="dashboard-section session-card">
        <div>
          <p className="dashboard-eyebrow">SEGURANÇA</p>
          <h2>Tempo autenticado</h2>
          <p>
            Esta sessão expira em{" "}
            {new Date(session.expiresAt).toLocaleString("pt-BR")}.
          </p>
        </div>
        <output className="session-duration" aria-live="off">
          {elapsedTime(session.authenticatedAt, now)}
        </output>
      </section>
    </main>
  );
}
