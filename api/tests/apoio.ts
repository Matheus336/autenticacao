import { createHmac } from "crypto";
import { mkdirSync, mkdtempSync, writeFileSync, appendFileSync } from "fs";
import { tmpdir } from "os";
import { resolve } from "path";

Bun.env.DATA_DIRECTORY = mkdtempSync(resolve(tmpdir(), "autenticacao-testes-"));

const { app } = await import("../src/app");
const { config } = await import("../src/config");
const { database } = await import("../src/database/connection");
const { decodeBase32 } = await import("../src/utils/base32");
const { criarServidorInseguro } = await import("./antes/servidor-inseguro");

export { config, database };

export const ORIGEM = config.webOrigin;
export const PASTA_EVIDENCIAS = resolve(import.meta.dir, "../../evidencias");
mkdirSync(PASTA_EVIDENCIAS, { recursive: true });

app.listen({ hostname: "127.0.0.1", port: 0 });
const inseguro = criarServidorInseguro().listen({ hostname: "127.0.0.1", port: 0 });

export const DEPOIS = `http://127.0.0.1:${app.server!.port}`;
export const ANTES = `http://127.0.0.1:${inseguro.server!.port}`;

export function encerrarServidores() {
  app.stop();
  inseguro.stop();
}

export type Resposta = {
  status: number;
  corpo: any;
  headers: Headers;
  setCookie: string | null;
  sid: string | null;
};

export async function requisitar(
  base: string,
  metodo: string,
  caminho: string,
  opcoes: { corpo?: unknown; cookie?: string | null; origem?: string | null } = {},
): Promise<Resposta> {
  const headers: Record<string, string> = {};
  if (opcoes.corpo !== undefined) headers["Content-Type"] = "application/json";
  if (opcoes.cookie) headers.Cookie = `sid=${opcoes.cookie}`;
  if (opcoes.origem !== null) headers.Origin = opcoes.origem ?? ORIGEM;

  const resposta = await fetch(`${base}${caminho}`, {
    method: metodo,
    headers,
    body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
  });
  const texto = await resposta.text();
  let corpo: any = texto;
  try {
    corpo = JSON.parse(texto);
  } catch {}
  const setCookie = resposta.headers.get("set-cookie");
  const sid = setCookie?.match(/(?:^|;\s*)sid=([^;]*)/)?.[1] || null;
  return { status: resposta.status, corpo, headers: resposta.headers, setCookie, sid };
}

function gerarCodigo(segredo: string, contador: number): string {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(contador));
  const digest = createHmac("sha1", decodeBase32(segredo)).update(buffer).digest();
  const offset = digest[digest.length - 1]! & 15;
  const binario = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(binario % 1_000_000).padStart(6, "0");
}

export function codigoTotp(segredo: string): string {
  return gerarCodigo(segredo, Math.floor(Date.now() / 30_000));
}

export function codigoTotpErrado(segredo: string, semente: number): string {
  const contador = Math.floor(Date.now() / 30_000);
  const validos = new Set([-1, 0, 1].map((d) => gerarCodigo(segredo, contador + d)));
  let candidato = semente % 1_000_000;
  while (validos.has(String(candidato).padStart(6, "0"))) candidato += 1;
  return String(candidato).padStart(6, "0");
}

export function limparTentativas() {
  database.exec("DELETE FROM auth_attempts");
}

export function mascararEmail(email: string): string {
  const [local, dominio] = email.split("@");
  return `${local!.slice(0, 2)}***@${dominio}`;
}

export function mascararToken(token: string | null): string {
  return token ? `${token.slice(0, 6)}…(${token.length} caracteres)` : "-";
}

export function abrirEvidencia(arquivo: string, titulo: string) {
  const caminho = resolve(PASTA_EVIDENCIAS, arquivo);
  writeFileSync(
    caminho,
    `# ${titulo}\n# Gerado por api/tests/seguranca.test.ts em ${new Date().toISOString()}\n` +
      "# Senhas, códigos TOTP, segredos e cookies aparecem mascarados.\n\n",
  );
  return (linha: string) => {
    const hora = new Date().toISOString().slice(11, 23);
    appendFileSync(caminho, `${hora}  ${linha}\n`);
  };
}

export async function cadastrar(base: string, email: string, senha: string, ra: string) {
  return requisitar(base, "POST", "/auth/register", {
    corpo: { fullName: "Conta de Teste", ra, email, password: senha },
  });
}

let proximoRa = 1000;

export async function cadastrarComMfa(email: string, senha: string): Promise<string> {
  proximoRa += 1;
  const cadastro = await cadastrar(DEPOIS, email, senha, `RA${proximoRa}`);
  if (cadastro.status !== 201) throw new Error(`cadastro falhou: ${cadastro.status}`);
  const segredo: string = cadastro.corpo.totpSetup.secret;
  const ativacao = await requisitar(DEPOIS, "POST", "/auth/totp/activate", {
    corpo: { email, password: senha, code: codigoTotp(segredo) },
  });
  if (ativacao.status !== 200) throw new Error(`ativação falhou: ${ativacao.status}`);
  return segredo;
}

export async function entrarComMfa(email: string, senha: string, segredo: string) {
  return requisitar(DEPOIS, "POST", "/auth/login", {
    corpo: { email, password: senha, code: codigoTotp(segredo) },
  });
}
