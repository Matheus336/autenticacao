import { useCallback, useEffect, useState } from "react";
import type { AuthSession } from "./types/auth";
import { getCurrentSession, logoutSession } from "./api/session";
import { getErrorMessage } from "./utils/errors";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Register from "./pages/Register";
import "./App.css";
import "./App.css";

function App() {
  const [page, setPage] = useState<"login" | "register">("login");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  useEffect(() => {
    let isActive = true;
    getCurrentSession()
      .then((currentSession) => {
        if (isActive) setSession(currentSession);
      })
      .catch((error: unknown) => {
        if (isActive) {
          setSessionError(
            getErrorMessage(error, "Não foi possível verificar sua sessão."),
          );
        }
      })
      .finally(() => {
        if (isActive) setCheckingSession(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const handleLogout = useCallback(async () => {
    setLogoutError("");
    setLoggingOut(true);
    try {
      await logoutSession();
      setSession(null);
      setPage("login");
    } catch (error: unknown) {
      setLogoutError(
        getErrorMessage(error, "Não foi possível encerrar a sessão."),
      );
    } finally {
      setLoggingOut(false);
    }
  }, []);

  if (checkingSession || sessionError) {
    return (
      <main className="login-page">
        <section className="auth-content">
          {checkingSession ? (
            <p className="auth-message" role="status">
              Verificando sessão...
            </p>
          ) : (
            <div className="auth-form">
              <p className="auth-error" role="alert">
                {sessionError}
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
              >
                Tentar novamente
              </button>
            </div>
          )}
        </section>
      </main>
    );
  }

  if (session) {
    return (
      <Dashboard
        session={session}
        onLogout={() => void handleLogout()}
        loggingOut={loggingOut}
        logoutError={logoutError}
        onDocumentUpdated={(document) =>
          setSession((current) =>
            current
              ? { ...current, user: { ...current.user, document } }
              : current,
          )
        }
      />
    );
  }

  return (
    <main className="login-page">
      {page === "login" ? (
        <Login
          onRegister={() => setPage("register")}
          onAuthenticated={setSession}
        />
      ) : (
        <Register onBackToLogin={() => setPage("login")} />
      )}
    </main>
  );
}

export default App;
