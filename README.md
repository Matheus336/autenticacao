# Sistema Acadêmico de Autenticação

Trabalho Prático 1 de Segurança e Auditoria em Sistemas (SA28S), UTFPR Câmpus Dois Vizinhos. Módulo de autenticação com cadastro, senha em Argon2id, MFA por TOTP, limitação de tentativas e sessão em cookie HttpOnly.

| Pasta | Conteúdo |
| --- | --- |
| `api/` | API em Bun/Elysia com SQLite ([README](api/README.md)) |
| `web/` | Interface em React/Vite ([README](web/README.md)) |
| `api/tests/` | Testes de segurança: força bruta, credential stuffing, sequestro de sessão e achados |
| `evidencias/` | Logs gerados pelos testes ([índice](evidencias/README.md)) |
| `docs/relatorio/` | Relatório técnico em Markdown e PDF |

## Executar

Requer Bun 1.3.14.

```bash
cd api
cp .env.example .env
bun install --frozen-lockfile
bun run dev
```

Em outro terminal:

```bash
cd web
cp .env.example .env
bun install --frozen-lockfile
bun run dev
```

## Testes de segurança

```bash
cd api
bun run test
```

A suíte sobe a API em um banco temporário e um servidor de referência sem os controles de segurança, executa os ataques contra os dois e regrava os logs em `evidencias/`.

## Relatório

`docs/relatorio/relatorio.pdf`. Para gerar o PDF de novo a partir do Markdown (requer Google Chrome e o pacote Python `pypdf`):

```bash
python docs/relatorio/gerar_pdf.py
```
