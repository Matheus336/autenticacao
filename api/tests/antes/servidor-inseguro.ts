import { createHash } from "crypto";
import { Elysia } from "elysia";
import { isRecord, rawString, stringValue } from "../../src/utils/guards";

// Linha de base "antes" usada só nos testes: mesma forma de API, sem os
// controles da versão real (hash sem sal, sem política de senha, sem MFA,
// sem limite de tentativas, sessão sequencial sem HttpOnly e sem expiração).
export function criarServidorInseguro() {
  const usuarios = new Map<string, { fullName: string; senhaSha256: string }>();
  const sessoes = new Map<string, string>();
  let proximaSessao = 1;

  const sha256 = (valor: string) => createHash("sha256").update(valor).digest("hex");
  const lerSid = (cookie: string | undefined) =>
    cookie?.match(/(?:^|;\s*)sid=([^;]+)/)?.[1] ?? null;

  return new Elysia({ prefix: "/auth" })
    .post("/register", ({ body, set }) => {
      const email = isRecord(body) ? stringValue(body.email).toLowerCase() : "";
      const senha = isRecord(body) ? rawString(body.password) : "";
      const fullName = isRecord(body) ? stringValue(body.fullName) : "";
      if (!email || !senha) {
        set.status = 400;
        return { error: "Dados do cadastro inválidos." };
      }
      if (usuarios.has(email)) {
        set.status = 409;
        return { error: "Este e-mail já está cadastrado." };
      }
      usuarios.set(email, { fullName, senhaSha256: sha256(senha) });
      set.status = 201;
      return { registered: true };
    })
    .post("/login", ({ body, set }) => {
      const email = isRecord(body) ? stringValue(body.email).toLowerCase() : "";
      const senha = isRecord(body) ? rawString(body.password) : "";
      const usuario = usuarios.get(email);
      if (!usuario || usuario.senhaSha256 !== sha256(senha)) {
        set.status = 401;
        return { error: "E-mail ou senha incorretos." };
      }
      const sid = String(proximaSessao++);
      sessoes.set(sid, email);
      set.headers["Set-Cookie"] = `sid=${sid}; Path=/`;
      return { authenticated: true };
    })
    .get("/me", ({ headers, set }) => {
      const sid = lerSid(headers.cookie);
      const email = sid ? sessoes.get(sid) : undefined;
      if (!email) {
        set.status = 401;
        return { error: "Sessão não autenticada." };
      }
      return { user: { email, fullName: usuarios.get(email)!.fullName } };
    })
    .post("/logout", ({ set }) => {
      set.headers["Set-Cookie"] = "sid=; Path=/; Max-Age=0";
      return { loggedOut: true };
    });
}
