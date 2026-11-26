# Evidências dos testes de segurança

Todos os arquivos desta pasta são gerados por `api/tests/seguranca.test.ts`. Para reproduzir, a partir da pasta `api`:

```bash
bun install --frozen-lockfile
bun test tests/
```

Os testes sobem duas instâncias locais em portas aleatórias, as duas em `127.0.0.1`:

- **antes**: servidor de referência inseguro (`api/tests/antes/servidor-inseguro.ts`). Guarda a senha como SHA-256 sem sal e não tem MFA nem limite de tentativas. O `sid` é sequencial, sem HttpOnly e sem expiração, e o logout não revoga a sessão.
- **depois**: a API do projeto (`api/src`), sem alterações, com banco SQLite temporário.

Senhas, códigos TOTP, segredos e cookies aparecem mascarados nos logs. Os e-mails são fictícios (`@teste.local`).

| Arquivo | Cenário |
| :- | :- |
| `resumo-antes-depois.md` | Tabela consolidada antes x depois |
| `forca-bruta.log` | Dicionário de 26 senhas comuns contra uma conta |
| `forca-bruta-totp.log` | Força bruta no código TOTP com a senha correta |
| `credential-stuffing.log` | 30 pares e-mail/senha, 10 válidos por reuso de senha |
| `limite-ip.log` | 25 contas, uma tentativa cada, a partir do mesmo IP |
| `contorno-limite-ip.log` | Achado: login válido na conta do atacante zera o contador do IP |
| `cookie-atributos.log` | Atributos do `Set-Cookie` |
| `adivinhacao-sessao.log` | Adivinhação de `sid` sem roubar o cookie |
| `sequestro-sessao.log` | Replay de cookie roubado; logout, novo login e expiração |
| `fixacao-csrf.log` | Fixação de sessão e logout com origem externa |
| `armazenamento.log` | Formato do hash de senha e do segredo TOTP no banco; política de senha |
| `rotas-auxiliares.log` | Achado: `/auth/encrypt` e `/auth/verify` sem autenticação |
| `replay-totp.log` | Achado: o mesmo código TOTP é aceito duas vezes |
| `mfa-pendente.log` | Achado: conta com MFA pendente entrega o segredo a quem tem a senha |
| `enumeracao.log` | Achado: enumeração de e-mail pelo cadastro e pelo tempo de resposta |
| `concorrencia-forca-bruta.log` | Achado: 100 tentativas simultâneas contornam o bloqueio por conta |
| `rotas-auxiliares-carga.log` | Carga em `/auth/verify` com hash bcrypt de custo 14 |
| `origem-login.log` | Achado: login aceito como formulário de outra origem |
| `erro-interno.log` | Achado: erro interno exposto em `/auth/verify` |
| `senha-longa.log` | Medição: login com senha de 2 MB |
