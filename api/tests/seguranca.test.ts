import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { randomBytes } from "crypto";
import { writeFileSync } from "fs";
import { resolve } from "path";
import {
  ANTES,
  DEPOIS,
  PASTA_EVIDENCIAS,
  abrirEvidencia,
  cadastrar,
  cadastrarComMfa,
  codigoTotp,
  codigoTotpErrado,
  database,
  encerrarServidores,
  entrarComMfa,
  limparTentativas,
  mascararEmail,
  mascararToken,
  requisitar,
} from "./apoio";

const TEMPO = 120_000;
const SENHA = "Seguranca2026";
const DICIONARIO = [
  "123456", "password", "12345678", "qwerty", "123456789", "12345", "1234",
  "111111", "1234567", "dragon", "123123", "baseball", "abc123", "football",
  "monkey", "letmein", "696969", "shadow", "master", "666666", "qwertyuiop",
  "123321", "mustang", "1234567890", SENHA, "michael",
];

const resumo: Array<{ cenario: string; antes: string; depois: string }> = [];

beforeEach(limparTentativas);

afterAll(() => {
  const linhas = [
    "# Resumo antes x depois",
    "",
    `Gerado por \`bun test\` em ${new Date().toISOString()}.`,
    "\"Antes\" = servidor de referência inseguro (api/tests/antes/servidor-inseguro.ts).",
    "\"Depois\" = API do projeto (api/src), sem alterações.",
    "",
    "| Cenário | Antes | Depois |",
    "| :- | :- | :- |",
    ...resumo.map((r) => `| ${r.cenario} | ${r.antes} | ${r.depois} |`),
    "",
  ];
  writeFileSync(resolve(PASTA_EVIDENCIAS, "resumo-antes-depois.md"), linhas.join("\n"));
  encerrarServidores();
});

describe("força bruta", () => {
  test("ataque de dicionário contra uma conta", async () => {
    const log = abrirEvidencia("forca-bruta.log", "Força bruta com dicionário de 26 senhas comuns contra uma conta");
    const email = "vitima.fb@teste.local";

    await cadastrar(ANTES, email, SENHA, "RA-FB");
    let tentativasAntes = 0;
    let acertouAntes = false;
    log(`[antes] alvo=${mascararEmail(email)}`);
    for (const senha of DICIONARIO) {
      tentativasAntes += 1;
      const r = await requisitar(ANTES, "POST", "/auth/login", { corpo: { email, password: senha } });
      log(`[antes] #${tentativasAntes} POST /auth/login -> ${r.status}${r.sid ? " (sessão criada)" : ""}`);
      if (r.status === 200) {
        acertouAntes = true;
        break;
      }
    }
    expect(acertouAntes).toBe(true);

    await cadastrarComMfa(email, SENHA);
    const status: number[] = [];
    let retryAfter = "";
    log(`[depois] alvo=${mascararEmail(email)}`);
    for (const [i, senha] of DICIONARIO.entries()) {
      const r = await requisitar(DEPOIS, "POST", "/auth/login", { corpo: { email, password: senha } });
      status.push(r.status);
      if (r.status === 429 && !retryAfter) retryAfter = r.headers.get("retry-after") ?? "";
      log(
        `[depois] #${i + 1} POST /auth/login -> ${r.status}` +
          (r.status === 429 ? ` Retry-After=${r.headers.get("retry-after")}s` : "") +
          (senha === SENHA ? " (senha correta enviada)" : ""),
      );
    }

    expect(status.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(status.slice(5).every((s) => s === 429)).toBe(true);
    expect(Number(retryAfter)).toBeGreaterThan(890);

    resumo.push({
      cenario: "Força bruta (26 senhas comuns, 1 conta)",
      antes: `senha descoberta na tentativa ${tentativasAntes}`,
      depois: `5 × 401, depois 21 × 429 (Retry-After ${retryAfter}s); senha correta na 25ª recebeu 429`,
    });
  }, TEMPO);

  test("força bruta no código TOTP com a senha correta", async () => {
    const log = abrirEvidencia("forca-bruta-totp.log", "Força bruta no segundo fator (senha já conhecida)");
    const email = "vitima.totp@teste.local";
    const segredo = await cadastrarComMfa(email, SENHA);
    const status: number[] = [];

    for (let i = 0; i < 7; i += 1) {
      const r = await requisitar(DEPOIS, "POST", "/auth/login", {
        corpo: { email, password: SENHA, code: codigoTotpErrado(segredo, 100_000 + i * 7919) },
      });
      status.push(r.status);
      log(`[depois] #${i + 1} POST /auth/login (senha correta, código errado) -> ${r.status}`);
    }
    const certo = await entrarComMfa(email, SENHA, segredo);
    log(`[depois] #8 POST /auth/login (senha e código corretos) -> ${certo.status}`);

    expect(status).toEqual([401, 401, 401, 401, 401, 429, 429]);
    expect(certo.status).toBe(429);

    resumo.push({
      cenario: "Força bruta no TOTP (senha vazada)",
      antes: "não há segundo fator: a senha basta",
      depois: "5 × 401, depois 429; com 10⁶ códigos e 5 tentativas/15 min a chance por janela é ~0,0015%",
    });
  }, TEMPO);
});

describe("credential stuffing", () => {
  test("lista vazada com reuso de senha em 10 contas", async () => {
    const log = abrirEvidencia("credential-stuffing.log", "Credential stuffing: 30 pares e-mail/senha, 10 válidos (reuso de senha)");
    const contas = Array.from({ length: 10 }, (_, i) => ({
      email: `usuario${i}.cs@teste.local`,
      senha: `Reuso${i}Senha2026`,
    }));
    const lista = contas.flatMap((c, i) => [
      { email: c.email, senha: DICIONARIO[i]! },
      { email: c.email, senha: DICIONARIO[i + 10]! },
      { email: c.email, senha: c.senha },
    ]);

    for (const [i, c] of contas.entries()) await cadastrar(ANTES, c.email, c.senha, `RA-CS${i}`);
    let sessoesAntes = 0;
    for (const [i, par] of lista.entries()) {
      const r = await requisitar(ANTES, "POST", "/auth/login", { corpo: { email: par.email, password: par.senha } });
      if (r.sid) sessoesAntes += 1;
      log(`[antes] #${i + 1} ${mascararEmail(par.email)} -> ${r.status}${r.sid ? " sessão criada" : ""}`);
    }

    for (const c of contas) await cadastrarComMfa(c.email, c.senha);
    limparTentativas();
    let sessoesDepois = 0;
    let senhasConfirmadas = 0;
    let bloqueios = 0;
    for (const [i, par] of lista.entries()) {
      const r = await requisitar(DEPOIS, "POST", "/auth/login", { corpo: { email: par.email, password: par.senha } });
      if (r.sid) sessoesDepois += 1;
      if (r.corpo?.requiresTotp) senhasConfirmadas += 1;
      if (r.status === 429) bloqueios += 1;
      log(
        `[depois] #${i + 1} ${mascararEmail(par.email)} -> ${r.status}` +
          (r.corpo?.requiresTotp ? " requiresTotp (senha correta, sem sessão)" : ""),
      );
    }

    expect(sessoesAntes).toBe(10);
    expect(sessoesDepois).toBe(0);
    expect(senhasConfirmadas).toBe(10);

    resumo.push({
      cenario: "Credential stuffing (30 pares, 10 válidos)",
      antes: `${sessoesAntes} sessões obtidas`,
      depois:
        `0 sessões (MFA); ${senhasConfirmadas} senhas confirmadas pelo atacante (resposta requiresTotp); ` +
        `${bloqueios} bloqueios por IP, porque cada acerto zera o contador do IP`,
    });
  }, TEMPO);

  test("spraying com pares inválidos de um mesmo IP aciona o limite por IP", async () => {
    const log = abrirEvidencia("limite-ip.log", "Limite por IP: 25 contas diferentes, uma tentativa errada cada");
    const statusAntes: number[] = [];
    const status: number[] = [];
    for (let i = 0; i < 25; i += 1) {
      const email = `inexistente${i}@teste.local`;
      const r = await requisitar(ANTES, "POST", "/auth/login", { corpo: { email, password: "Errada123" } });
      statusAntes.push(r.status);
      log(`[antes]  #${i + 1} ${mascararEmail(email)} -> ${r.status}`);
    }
    for (let i = 0; i < 25; i += 1) {
      const email = `inexistente${i}@teste.local`;
      const r = await requisitar(DEPOIS, "POST", "/auth/login", { corpo: { email, password: "Errada123" } });
      status.push(r.status);
      log(`[depois] #${i + 1} ${mascararEmail(email)} -> ${r.status}`);
    }
    expect(statusAntes.every((s) => s === 401)).toBe(true);
    expect(status.slice(0, 20).every((s) => s === 401)).toBe(true);
    expect(status.slice(20).every((s) => s === 429)).toBe(true);

    resumo.push({
      cenario: "Spraying de um IP (25 contas, 1 tentativa cada)",
      antes: `${statusAntes.filter((s) => s === 401).length} × 401, nenhum 429`,
      depois: "20 × 401, depois 429 a partir da 21ª",
    });
  }, TEMPO);

  test("achado: login válido em conta própria zera o contador do IP", async () => {
    const log = abrirEvidencia("contorno-limite-ip.log", "Achado: atacante intercala login na própria conta e nunca atinge o limite por IP");
    const propria = "atacante@teste.local";
    await cadastrarComMfa(propria, SENHA);
    const status: number[] = [];

    for (let i = 0; i < 60; i += 1) {
      if (i > 0 && i % 19 === 0) {
        const r = await requisitar(DEPOIS, "POST", "/auth/login", { corpo: { email: propria, password: SENHA } });
        log(`[depois] login na conta do atacante -> ${r.status} (contador do IP zerado)`);
      }
      const email = `alvo${i}@teste.local`;
      const r = await requisitar(DEPOIS, "POST", "/auth/login", { corpo: { email, password: "Errada123" } });
      status.push(r.status);
      log(`[depois] tentativa #${i + 1} ${mascararEmail(email)} -> ${r.status}`);
    }

    expect(status.filter((s) => s === 429)).toHaveLength(0);
    resumo.push({
      cenario: "Contorno do limite por IP (achado)",
      antes: "não há limite",
      depois: "60 tentativas erradas sem nenhum 429, intercalando 3 logins válidos (clearAuthFailures limpa também o escopo IP)",
    });
  }, TEMPO);
});

describe("sequestro de sessão", () => {
  test("atributos do cookie de sessão", async () => {
    const log = abrirEvidencia("cookie-atributos.log", "Atributos do Set-Cookie (valor do token mascarado)");
    const email = "cookie@teste.local";
    await cadastrar(ANTES, email, SENHA, "RA-CK");
    const antes = await requisitar(ANTES, "POST", "/auth/login", { corpo: { email, password: SENHA } });
    const segredo = await cadastrarComMfa(email, SENHA);
    const depois = await entrarComMfa(email, SENHA, segredo);

    const mascarar = (c: string | null) => c?.replace(/sid=[^;]+/, (m) => `sid=${mascararToken(m.slice(4))}`) ?? "-";
    log(`[antes]  Set-Cookie: ${mascarar(antes.setCookie)}`);
    log(`[depois] Set-Cookie: ${mascarar(depois.setCookie)}`);

    expect(antes.setCookie).not.toContain("HttpOnly");
    expect(depois.setCookie).toContain("HttpOnly");
    expect(depois.setCookie).toContain("SameSite=Lax");
    expect(depois.setCookie).toContain("Max-Age=28800");
    expect(depois.sid!.length).toBe(43);

    resumo.push({
      cenario: "Atributos do cookie",
      antes: "`sid=<n>; Path=/` (legível por JavaScript, sem expiração)",
      depois: "`HttpOnly; SameSite=Lax; Max-Age=28800`, token de 256 bits; `Secure` só com NODE_ENV=production",
    });
  }, TEMPO);

  test("adivinhação de identificador de sessão", async () => {
    const log = abrirEvidencia("adivinhacao-sessao.log", "Atacante tenta adivinhar sid sem roubar o cookie");
    const email = "previsivel@teste.local";
    await cadastrar(ANTES, email, SENHA, "RA-PR");
    await requisitar(ANTES, "POST", "/auth/login", { corpo: { email, password: SENHA } });

    let validasAntes = 0;
    for (let sid = 1; sid <= 50; sid += 1) {
      const r = await requisitar(ANTES, "GET", "/auth/me", { cookie: String(sid) });
      if (r.status === 200) validasAntes += 1;
    }
    log(`[antes]  sid=1..50 -> ${validasAntes} sessões válidas de outros usuários encontradas`);

    let validasDepois = 0;
    for (let i = 0; i < 200; i += 1) {
      const r = await requisitar(DEPOIS, "GET", "/auth/me", { cookie: randomBytes(32).toString("base64url") });
      if (r.status === 200) validasDepois += 1;
    }
    log(`[depois] 200 tokens aleatórios de 256 bits -> ${validasDepois} válidos`);

    expect(validasAntes).toBeGreaterThan(0);
    expect(validasDepois).toBe(0);
    resumo.push({
      cenario: "Adivinhação de sid",
      antes: `${validasAntes} sessões alheias encontradas testando sid=1..50`,
      depois: "0 de 200 tokens aleatórios (espaço de 2²⁵⁶)",
    });
  }, TEMPO);

  test("reuso de cookie roubado, logout, novo login e expiração", async () => {
    const log = abrirEvidencia("sequestro-sessao.log", "Replay de cookie roubado antes e depois do logout, novo login e expiração");
    const email = "replay@teste.local";

    await cadastrar(ANTES, email, SENHA, "RA-RP");
    const loginAntes = await requisitar(ANTES, "POST", "/auth/login", { corpo: { email, password: SENHA } });
    const roubadoAntes = loginAntes.sid!;
    const replayAntes = await requisitar(ANTES, "GET", "/auth/me", { cookie: roubadoAntes });
    await requisitar(ANTES, "POST", "/auth/logout", { cookie: roubadoAntes });
    const posLogoutAntes = await requisitar(ANTES, "GET", "/auth/me", { cookie: roubadoAntes });
    log(`[antes]  cookie copiado, GET /auth/me de outro cliente -> ${replayAntes.status}`);
    log(`[antes]  vítima faz logout; replay do mesmo cookie -> ${posLogoutAntes.status}`);

    const segredo = await cadastrarComMfa(email, SENHA);
    const loginDepois = await entrarComMfa(email, SENHA, segredo);
    const roubado = loginDepois.sid!;
    const replay = await requisitar(DEPOIS, "GET", "/auth/me", { cookie: roubado });
    log(`[depois] cookie ${mascararToken(roubado)} copiado, GET /auth/me de outro cliente -> ${replay.status}`);
    const logout = await requisitar(DEPOIS, "POST", "/auth/logout", { cookie: roubado });
    const posLogout = await requisitar(DEPOIS, "GET", "/auth/me", { cookie: roubado });
    log(`[depois] vítima faz logout (${logout.status}); replay do mesmo cookie -> ${posLogout.status}`);

    const primeiro = (await entrarComMfa(email, SENHA, segredo)).sid!;
    const segundo = await requisitar(DEPOIS, "POST", "/auth/login", {
      corpo: { email, password: SENHA, code: codigoTotp(segredo) },
      cookie: primeiro,
    });
    const antigo = await requisitar(DEPOIS, "GET", "/auth/me", { cookie: primeiro });
    log(`[depois] novo login enviando o cookie anterior (${segundo.status}); cookie anterior -> ${antigo.status}`);

    database.query("UPDATE sessions SET expires_at = ?").run(Date.now() - 1);
    const expirado = await requisitar(DEPOIS, "GET", "/auth/me", { cookie: segundo.sid });
    log(`[depois] expires_at forçado para o passado no banco; GET /auth/me -> ${expirado.status}`);

    expect(replayAntes.status).toBe(200);
    expect(posLogoutAntes.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(posLogout.status).toBe(401);
    expect(antigo.status).toBe(401);
    expect(expirado.status).toBe(401);

    resumo.push({
      cenario: "Replay de cookie roubado",
      antes: "200 enquanto a vítima está logada e 200 após o logout",
      depois: "200 enquanto a sessão vale (limitação de token portador); 401 após logout, novo login ou expiração",
    });
  }, TEMPO);

  test("fixação de sessão e CSRF no logout", async () => {
    const log = abrirEvidencia("fixacao-csrf.log", "Fixação de sessão e logout cross-site");
    const email = "fixacao@teste.local";
    const segredo = await cadastrarComMfa(email, SENHA);
    const plantado = randomBytes(32).toString("base64url");

    const login = await requisitar(DEPOIS, "POST", "/auth/login", {
      corpo: { email, password: SENHA, code: codigoTotp(segredo) },
      cookie: plantado,
    });
    const usoPlantado = await requisitar(DEPOIS, "GET", "/auth/me", { cookie: plantado });
    log(`[depois] vítima entra com sid plantado pelo atacante; servidor emite outro sid: ${login.sid !== plantado}`);
    log(`[depois] atacante usa o sid plantado -> ${usoPlantado.status}`);

    const semOrigem = await requisitar(DEPOIS, "POST", "/auth/logout", { cookie: login.sid, origem: null });
    const origemMaliciosa = await requisitar(DEPOIS, "POST", "/auth/logout", { cookie: login.sid, origem: "https://atacante.example" });
    const aindaValida = await requisitar(DEPOIS, "GET", "/auth/me", { cookie: login.sid });
    log(`[depois] POST /auth/logout sem Origin -> ${semOrigem.status}; Origin atacante -> ${origemMaliciosa.status}; sessão continua -> ${aindaValida.status}`);

    expect(login.sid).not.toBe(plantado);
    expect(usoPlantado.status).toBe(401);
    expect(semOrigem.status).toBe(403);
    expect(origemMaliciosa.status).toBe(403);
    expect(aindaValida.status).toBe(200);

    resumo.push({
      cenario: "Fixação de sessão / CSRF no logout",
      antes: "não testado (logout não revoga a sessão no servidor, ver replay)",
      depois: "sid plantado ignorado (401); logout sem Origin ou com origem externa -> 403",
    });
  }, TEMPO);
});

describe("hash, política de senha e achados adicionais", () => {
  test("armazenamento de senha e de segredo TOTP", async () => {
    const log = abrirEvidencia("armazenamento.log", "Formato da senha e do segredo TOTP no SQLite (valores truncados)");
    const email = "hash@teste.local";
    await cadastrarComMfa(email, SENHA);
    const linha = database
      .query("SELECT password_hash, totp_secret FROM users WHERE email = ?")
      .get(email) as { password_hash: string; totp_secret: string };

    const fraca = await cadastrar(DEPOIS, "fraca@teste.local", "abc", "RA-F1");
    const comum = await cadastrar(DEPOIS, "comum@teste.local", "Senha123", "RA-F2");
    log(`[depois] password_hash = ${linha.password_hash.split("$").slice(0, 4).join("$")}$…`);
    log(`[depois] totp_secret em texto claro: ${/^[A-Z2-7]{32}$/.test(linha.totp_secret)} (${linha.totp_secret.length} caracteres base32)`);
    log(`[depois] cadastro com senha "abc" -> ${fraca.status}`);
    log(`[depois] cadastro com senha comum "Senha123" -> ${comum.status} (aceita: sem lista de senhas vazadas)`);
    log(`[antes]  senha guardada como SHA-256 sem sal; qualquer senha não vazia é aceita`);

    expect(linha.password_hash.startsWith("$argon2id$v=19$m=65536,t=2,p=1$")).toBe(true);
    expect(fraca.status).toBe(400);
    expect(comum.status).toBe(201);

    resumo.push({
      cenario: "Armazenamento da senha",
      antes: "SHA-256 sem sal, sem política",
      depois: "Argon2id (m=64 MiB, t=2, p=1); política 8–128 com maiúscula, minúscula e dígito; \"Senha123\" ainda é aceita",
    });
  }, TEMPO);

  test("achado: rotas /auth/encrypt e /auth/verify públicas", async () => {
    const log = abrirEvidencia("rotas-auxiliares.log", "Achado: rotas auxiliares de hash acessíveis sem autenticação");
    const enc = await requisitar(DEPOIS, "POST", "/auth/encrypt", {
      corpo: { username: "x", password: "123456" },
      origem: null,
    });
    const ver = await requisitar(DEPOIS, "POST", "/auth/verify", {
      corpo: { password: "123456", hash: enc.corpo.hashBcrypt },
      origem: null,
    });
    log(`[depois] POST /auth/encrypt sem sessão -> ${enc.status}, hash começa com ${String(enc.corpo.hashBcrypt).slice(0, 7)}`);
    log(`[depois] POST /auth/verify sem sessão -> ${ver.status}, verified=${ver.corpo.verified}`);

    expect(enc.status).toBe(200);
    expect(enc.corpo.hashBcrypt.startsWith("$2b$04$")).toBe(true);
    expect(ver.corpo.verified).toBe(true);
  }, TEMPO);

  test("achado: o mesmo código TOTP é aceito duas vezes", async () => {
    const log = abrirEvidencia("replay-totp.log", "Achado: reutilização do mesmo código TOTP dentro da janela");
    const email = "replaytotp@teste.local";
    const segredo = await cadastrarComMfa(email, SENHA);
    const codigo = codigoTotp(segredo);
    const primeiro = await requisitar(DEPOIS, "POST", "/auth/login", { corpo: { email, password: SENHA, code: codigo } });
    const segundo = await requisitar(DEPOIS, "POST", "/auth/login", { corpo: { email, password: SENHA, code: codigo } });
    log(`[depois] login com código C -> ${primeiro.status}; mesmo código C de novo -> ${segundo.status}`);

    expect(primeiro.status).toBe(200);
    expect(segundo.status).toBe(200);
  }, TEMPO);

  test("achado: conta com MFA pendente entrega o segredo a quem tem a senha", async () => {
    const log = abrirEvidencia("mfa-pendente.log", "Achado: atacante com a senha ativa o MFA no próprio celular");
    const email = "pendente@teste.local";
    const cadastro = await cadastrar(DEPOIS, email, SENHA, "RA-PD");
    const doAtacante = await requisitar(DEPOIS, "POST", "/auth/login", { corpo: { email, password: SENHA } });
    const segredo: string = doAtacante.corpo.totpSetup.secret;
    const ativa = await requisitar(DEPOIS, "POST", "/auth/login", {
      corpo: { email, password: SENHA, code: codigoTotp(segredo) },
    });
    log(`[depois] vítima se cadastra (${cadastro.status}) e não conclui a ativação do TOTP`);
    log(`[depois] atacante com a senha: POST /auth/login sem código -> ${doAtacante.status}, recebe totpSetup.secret`);
    log(`[depois] atacante envia código gerado com esse segredo -> ${ativa.status}, sessão criada: ${Boolean(ativa.sid)}`);

    expect(ativa.status).toBe(200);
    expect(ativa.sid).toBeTruthy();
  }, TEMPO);

  test("achado: enumeração de contas", async () => {
    const log = abrirEvidencia("enumeracao.log", "Achado: enumeração de e-mails pelo cadastro e pelo tempo de resposta");
    const email = "existe@teste.local";
    await cadastrarComMfa(email, SENHA);
    const duplicado = await cadastrar(DEPOIS, email, SENHA, "RA-OUTRO");
    log(`[depois] cadastro com e-mail já existente -> ${duplicado.status} "${duplicado.corpo.error}"`);

    const medir = async (alvo: string) => {
      limparTentativas();
      const inicio = performance.now();
      await requisitar(DEPOIS, "POST", "/auth/login", { corpo: { email: alvo, password: "Errada123" } });
      return performance.now() - inicio;
    };
    const existentes: number[] = [];
    const inexistentes: number[] = [];
    for (let i = 0; i < 8; i += 1) {
      existentes.push(await medir(email));
      inexistentes.push(await medir(`nao${i}@teste.local`));
    }
    const mediana = (v: number[]) => v.sort((a, b) => a - b)[Math.floor(v.length / 2)]!;
    log(`[depois] login com senha errada, mediana de 8: e-mail existente ${mediana(existentes).toFixed(1)} ms; inexistente ${mediana(inexistentes).toFixed(1)} ms`);

    expect(duplicado.status).toBe(409);
    expect(mediana(existentes)).toBeGreaterThan(mediana(inexistentes));
  }, TEMPO);
});

describe("achados verificados por medição", () => {
  test("achado: requisições simultâneas contornam o bloqueio por conta", async () => {
    const log = abrirEvidencia("concorrencia-forca-bruta.log", "Achado: 100 tentativas de senha enviadas ao mesmo tempo contra uma conta");
    const email = "concorrencia@teste.local";
    await cadastrarComMfa(email, SENHA);
    const senhas = Array.from({ length: 100 }, (_, i) => (i === 98 ? SENHA : `Errada${i}x`));
    const respostas = await Promise.all(
      senhas.map((password) => requisitar(DEPOIS, "POST", "/auth/login", { corpo: { email, password } })),
    );
    const contagem = (s: number) => respostas.filter((r) => r.status === s).length;
    const correta = respostas[98]!;
    log(`[depois] 100 requisições simultâneas: ${contagem(401)} × 401, ${contagem(429)} × 429, ${contagem(200)} × 200`);
    log(`[depois] senha correta na 99ª posição -> ${correta.status}${correta.corpo?.requiresTotp ? " requiresTotp (senha confirmada)" : ""}`);
    const sequencial = await requisitar(DEPOIS, "POST", "/auth/login", { corpo: { email, password: "Errada999x" } });
    log(`[depois] tentativa seguinte, já sequencial -> ${sequencial.status}`);

    expect(contagem(429)).toBeLessThan(95);
    expect(correta.corpo?.requiresTotp).toBe(true);
    resumo.push({
      cenario: "Força bruta com 100 requisições simultâneas (achado)",
      antes: "não há limite",
      depois: `${contagem(401)} × 401 e ${contagem(429)} × 429; a senha correta foi confirmada`,
    });
  }, TEMPO);

  test("achado: /auth/verify com hash de custo alto atrasa o login", async () => {
    const log = abrirEvidencia("rotas-auxiliares-carga.log", "Achado A-03: carga em /auth/verify com hash bcrypt de custo 14");
    const email = "carga@teste.local";
    await cadastrarComMfa(email, SENHA);
    const medirLogin = async () => {
      limparTentativas();
      const inicio = performance.now();
      await requisitar(DEPOIS, "POST", "/auth/login", { corpo: { email, password: SENHA } });
      return performance.now() - inicio;
    };
    const base = await medirLogin();
    const hashCaro = await Bun.password.hash("x", { algorithm: "bcrypt", cost: 14 });
    const inicioVerify = performance.now();
    const carga = Array.from({ length: 4 }, () =>
      requisitar(DEPOIS, "POST", "/auth/verify", { corpo: { password: "y", hash: hashCaro }, origem: null }),
    );
    await Bun.sleep(100);
    const sobCarga = await medirLogin();
    const resultados = await Promise.all(carga);
    const duracaoVerify = performance.now() - inicioVerify;
    log(`[depois] CPUs disponíveis: ${navigator.hardwareConcurrency}`);
    log(`[depois] login sem carga: ${base.toFixed(0)} ms`);
    log(`[depois] 4 × POST /auth/verify anônimos com bcrypt custo 14 -> ${resultados.map((r) => r.status).join(", ")}, ${duracaoVerify.toFixed(0)} ms no total`);
    log(`[depois] login durante a carga: ${sobCarga.toFixed(0)} ms`);

    expect(resultados.every((r) => r.status === 200)).toBe(true);
  }, TEMPO);

  test("achado: login aceita formulário de outra origem", async () => {
    const log = abrirEvidencia("origem-login.log", "Achado A-05: login enviado como formulário HTML de outra origem");
    const email = "csrf@teste.local";
    const segredo = await cadastrarComMfa(email, SENHA);
    const corpo = new URLSearchParams({ email, password: SENHA, code: codigoTotp(segredo) });
    const r = await fetch(`${DEPOIS}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: "https://atacante.example" },
      body: corpo,
    });
    const setCookie = r.headers.get("set-cookie");
    log(`[depois] POST /auth/login (form-urlencoded, Origin: https://atacante.example) -> ${r.status}, cookie emitido: ${Boolean(setCookie?.includes("sid="))}`);

    expect(r.status).toBe(200);
    expect(setCookie).toContain("sid=");
  }, TEMPO);

  test("achado: erro interno exposto em /auth/verify", async () => {
    const log = abrirEvidencia("erro-interno.log", "Achado A-11: hash inválido em /auth/verify");
    const r = await requisitar(DEPOIS, "POST", "/auth/verify", { corpo: { password: "x", hash: "invalido" }, origem: null });
    const texto = typeof r.corpo === "string" ? r.corpo : JSON.stringify(r.corpo);
    log(`[depois] POST /auth/verify com hash "invalido" -> ${r.status}`);
    log(`[depois] corpo da resposta (até 160 caracteres): ${texto.slice(0, 160)}`);

    expect(r.status).toBe(500);
  }, TEMPO);

  test("medição: senha de 2 MB no login", async () => {
    const log = abrirEvidencia("senha-longa.log", "Observação da seção 6.3: custo de uma senha de 2 MB no login");
    const email = "longa@teste.local";
    await cadastrarComMfa(email, SENHA);
    const medir = async (password: string) => {
      const tempos: number[] = [];
      for (let i = 0; i < 3; i += 1) {
        limparTentativas();
        const inicio = performance.now();
        await requisitar(DEPOIS, "POST", "/auth/login", { corpo: { email, password } });
        tempos.push(performance.now() - inicio);
      }
      return tempos.sort((a, b) => a - b)[1]!;
    };
    const normal = await medir("Errada123");
    const longa = await medir("a".repeat(2_000_000));
    log(`[depois] login com senha errada de 9 caracteres: ${normal.toFixed(0)} ms (mediana de 3)`);
    log(`[depois] login com senha de 2.000.000 caracteres: ${longa.toFixed(0)} ms (mediana de 3)`);

    expect(longa).toBeGreaterThan(0);
  }, TEMPO);
});
