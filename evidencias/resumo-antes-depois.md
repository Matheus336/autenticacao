# Resumo antes x depois

Gerado por `bun test` em 2026-11-25T23:56:29.829Z.
"Antes" = servidor de referência inseguro (api/tests/antes/servidor-inseguro.ts).
"Depois" = API do projeto (api/src), sem alterações.

| Cenário | Antes | Depois |
| :- | :- | :- |
| Força bruta (26 senhas comuns, 1 conta) | senha descoberta na tentativa 25 | 5 × 401, depois 21 × 429 (Retry-After 900s); senha correta na 25ª recebeu 429 |
| Força bruta no TOTP (senha vazada) | não há segundo fator: a senha basta | 5 × 401, depois 429; com 10⁶ códigos e 5 tentativas/15 min a chance por janela é ~0,0015% |
| Credential stuffing (30 pares, 10 válidos) | 10 sessões obtidas | 0 sessões (MFA); 10 senhas confirmadas pelo atacante (resposta requiresTotp); 0 bloqueios por IP, porque cada acerto zera o contador do IP |
| Spraying de um IP (25 contas, 1 tentativa cada) | 25 × 401, nenhum 429 | 20 × 401, depois 429 a partir da 21ª |
| Contorno do limite por IP (achado) | não há limite | 60 tentativas erradas sem nenhum 429, intercalando 3 logins válidos (clearAuthFailures limpa também o escopo IP) |
| Atributos do cookie | `sid=<n>; Path=/` (legível por JavaScript, sem expiração) | `HttpOnly; SameSite=Lax; Max-Age=28800`, token de 256 bits; `Secure` só com NODE_ENV=production |
| Adivinhação de sid | 13 sessões alheias encontradas testando sid=1..50 | 0 de 200 tokens aleatórios (espaço de 2²⁵⁶) |
| Replay de cookie roubado | 200 enquanto a vítima está logada e 200 após o logout | 200 enquanto a sessão vale (limitação de token portador); 401 após logout, novo login ou expiração |
| Fixação de sessão / CSRF no logout | não testado (logout não revoga a sessão no servidor, ver replay) | sid plantado ignorado (401); logout sem Origin ou com origem externa -> 403 |
| Armazenamento da senha | SHA-256 sem sal, sem política | Argon2id (m=64 MiB, t=2, p=1); política 8–128 com maiúscula, minúscula e dígito; "Senha123" ainda é aceita |
| Força bruta com 100 requisições simultâneas (achado) | não há limite | 99 × 401 e 0 × 429; a senha correta foi confirmada |
