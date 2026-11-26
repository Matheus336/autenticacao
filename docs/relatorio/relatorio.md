# UNIVERSIDADE TECNOLÓGICA FEDERAL DO PARANÁ

CÂMPUS DOIS VIZINHOS

SEGURANÇA E AUDITORIA EM SISTEMAS (SA28S)

TRABALHO PRÁTICO 1

**SISTEMA ACADÊMICO DE AUTENTICAÇÃO**

Relatório técnico de auditoria de segurança: Implementação de Autenticação Segura e Gestão de Identidades

| Integrantes |
| --- |
| Ana Clara Rodrigues Marques Santana |
| Caio Almeida Carvalho Lima |
| Cleiton Horalino Soares de Morais |
| Felipe Rodrigo Ferreira |
| Grazieli Maria Sarturi |
| Matheus Felipe de Aguiar |
| Murilo Pedron Dal Molim |
| Pedro Luciano Moura Kuhn |

Relatório técnico apresentado à disciplina Segurança e Auditoria em Sistemas (SA28S) da Universidade Tecnológica Federal do Paraná, como entrega do Trabalho Prático 1, tema Implementação de Autenticação Segura e Gestão de Identidades.

Professor: Erinaldo da Silva Pereira

DOIS VIZINHOS

2026

## Controle de versões

| Versão | Data | Responsável | Descrição |
| --- | --- | --- | --- |
| 1.0 | 23/11/2026 | Grupo | Versão inicial: inspeção do código e verificações manuais. |
| 2.0 | 25/11/2026 | Grupo | Testes automatizados com evidências, comparação antes × depois, achados classificados por CVSS 3.1, teste de concorrência e estrutura conforme ABNT NBR 10719 e OWASP WSTG. |

## Resumo

Este relatório audita o Sistema Acadêmico de Autenticação, módulo de autenticação desenvolvido pelo grupo: uma API em Bun/Elysia com banco SQLite. O módulo implementa hash de senha com Argon2id, política de senha, autenticação multifator por TOTP, limitação de tentativas com bloqueio temporário e sessões em cookie HttpOnly. A avaliação seguiu o OWASP ASVS 4.0.3 e o OWASP WSTG e usou 19 testes automatizados. Os testes simulam força bruta, credential stuffing e sequestro de sessão contra a API e contra um servidor de referência sem esses controles. Na API, a força bruta foi bloqueada após 5 falhas. O credential stuffing não abriu nenhuma sessão em contas com TOTP ativo, e o logout invalidou cópias do cookie. Requisições simultâneas, porém, contornaram o bloqueio por conta. O relatório registra 12 achados (2 de severidade alta, 8 média e 2 baixa): 6 comprovados por teste e 6 comprovados em parte.

**Palavras-chave:** autenticação; TOTP; força bruta; gerenciamento de sessão; OWASP ASVS.

## Sumário

1 Introdução
1.1 Objetivo
1.2 Escopo
1.3 Cronograma
1.4 Limitações
1.5 Aviso
2 Sumário executivo
3 Metodologia
3.1 Referências de avaliação
3.2 Comparação antes × depois
3.3 Execução dos testes
4 Sistema avaliado e controles implementados
4.1 Arquitetura
4.2 Atendimento aos requisitos do trabalho
5 Testes e resultados
5.1 Força bruta contra a senha
5.2 Força bruta contra o TOTP
5.3 Credential stuffing
5.4 Password spraying e limite por IP
5.5 Sequestro de sessão
5.6 Comparação antes × depois
6 Achados
6.1 Resumo dos achados
6.2 Detalhamento
6.3 Observações sem classificação de risco
7 Trade-offs entre usabilidade e segurança
8 Considerações finais
Referências
Apêndice A — Escala de severidade
Apêndice B — Checklist de verificação (OWASP ASVS 4.0.3)
Apêndice C — Evidências e reprodução

## 1 Introdução

### 1.1 Objetivo

Verificar se o Sistema Acadêmico de Autenticação atende aos requisitos do Trabalho Prático 1. Medir, com testes reproduzíveis, quanto seus controles reduzem o sucesso de ataques de força bruta, credential stuffing e sequestro de sessão.

### 1.2 Escopo

| Dentro do escopo | Fora do escopo |
| --- | --- |
| API em `api/src`: cadastro, ativação do TOTP, login, sessão, logout, perfil (CPF e avatar) e rotas auxiliares `/auth/encrypt` e `/auth/verify` | Interface em `web/src` (consultada apenas para descrever o fluxo, sem avaliação de segurança) |
| Banco SQLite gerado pela API | Implantação em produção, HTTPS e proxy reverso |
| | Ataques distribuídos de vários IPs e negação de serviço por carga |

Versões avaliadas:

| Artefato | Localização |
| --- | --- |
| Código da aplicação | https://github.com/Matheus336/autenticacao, commit `3186942` (branch `main`) |
| Testes, evidências e este relatório | Pacote entregue com este relatório (pastas `api/tests`, `evidencias` e `docs/relatorio`), também enviados ao repositório |

### 1.3 Cronograma

| Data | Atividade |
| --- | --- |
| 26/10/2026 | Publicação do código do módulo no repositório |
| 23/11/2026 | Versão 1.0 do relatório (inspeção e verificações manuais) |
| 24/11/2026 | Testes automatizados, coleta de evidências e revisão do relatório |
| 25/11/2026 | Teste de concorrência e medições complementares |
| 25/11/2026 | Entrega da versão 2.0 |

### 1.4 Limitações

- Os testes usaram HTTP em `127.0.0.1`, um único IP de origem e clientes programáticos. Não houve avaliação de HTTPS, proxies, ataques distribuídos nem do comportamento de cookies em navegadores reais. Nenhum script foi executado em navegador.
- O cookie foi emitido sem `Secure`, porque a API só ativa esse atributo com `NODE_ENV=production`.
- A expiração foi testada alterando o prazo no banco temporário, sem aguardar 8 horas. O replay de sessão partiu de uma cópia do cookie já em mãos; o furto do cookie não foi simulado.
- O grupo não tinha versão anterior do sistema. O "antes" é um servidor de referência construído para a comparação (seção 3.2).
- Os tempos de resposta valem para a máquina local e variam entre execuções.

### 1.5 Aviso

Esta avaliação retrata o código na data do relatório e não garante a ausência de outras vulnerabilidades. Todos os ataques foram executados em ambiente local, com contas fictícias.

## 2 Sumário executivo

Dos nove requisitos avaliados na seção 4.2, o sistema atende integralmente três, parcialmente cinco, e um está ausente. As senhas são guardadas com Argon2id, um algoritmo feito para tornar lenta a quebra de senhas roubadas. O login exige um segundo fator: um código de 6 dígitos gerado por aplicativo autenticador no celular (TOTP). Tentativas repetidas são bloqueadas por 15 minutos. O cookie de sessão não pode ser lido por scripts e é invalidado no logout. Resultado dos mesmos ataques contra um sistema sem esses controles e contra o módulo:

| Ataque | Sem controles (antes) | Módulo do grupo (depois) |
| --- | --- | --- |
| Adivinhar a senha com 26 senhas comuns | Senha descoberta na 25ª tentativa | Bloqueado após 5 falhas; a senha correta também recebeu bloqueio |
| Testar 30 credenciais vazadas, 10 válidas | 10 contas invadidas | Nenhuma sessão aberta |
| Adivinhar um identificador de sessão | 13 sessões alheias encontradas em 50 tentativas | Nenhum acerto em 200 tentativas |
| Reusar o cookie após o logout da vítima | Acesso mantido | Acesso negado |
| Enviar 100 senhas ao mesmo tempo contra uma conta | Não testado; a referência não tem bloqueio | Nenhuma bloqueada; a senha correta foi confirmada |

A auditoria registrou 12 achados: 2 de severidade alta, 8 média e 2 baixa. Os que devem ser corrigidos primeiro são:

1. Tomada de conta antes da ativação do segundo fator (Alta). Se o usuário se cadastra e não conclui a configuração do aplicativo autenticador, quem souber a senha recebe a chave do segundo fator e passa a controlá-lo. Comprovado por teste.
2. Bloqueio contornado por requisições simultâneas (Média). O limite de 5 falhas por conta só é contado depois que cada senha é verificada. Com 100 tentativas enviadas ao mesmo tempo, nenhuma foi bloqueada e a senha correta foi confirmada. Comprovado por teste.
3. Endpoints de teste expostos sem login (Alta, estimada). Duas rotas auxiliares de hash (`/auth/encrypt` e `/auth/verify`) respondem a qualquer pessoa. A segunda verifica hashes enviados pelo cliente sem limitar o custo, o que ocupa o processador. O acesso e a carga foram medidos; a indisponibilidade do login foi estimada.

O CAPTCHA, citado no enunciado, não foi implementado. A seção 7 discute essa escolha.

## 3 Metodologia

### 3.1 Referências de avaliação

- OWASP ASVS 4.0.3 (OWASP, 2021), capítulos V2 (autenticação) e V3 (gerenciamento de sessão): critérios de verificação, nível 2. O Apêndice B lista os requisitos verificados.
- NIST SP 800-63B-4 (NIST, 2025): diretrizes para senhas e autenticadores, usadas na avaliação da política de senha (seção 7).
- OWASP WSTG v4.2 (OWASP, 2020): seleção dos casos de teste e estrutura deste relatório.
- CVSS 3.1 (FIRST, 2019): severidade dos achados (Apêndice A).

### 3.2 Comparação antes × depois

Como não existia uma versão anterior, o grupo construiu um servidor de referência (`api/tests/antes/servidor-inseguro.ts`). Ele tem a mesma interface da API e nenhum dos controles avaliados:

- senha em SHA-256 sem sal;
- nenhuma política de senha, MFA ou limite de tentativas;
- identificador de sessão sequencial (1, 2, 3...), sem HttpOnly e sem expiração;
- logout que não invalida a sessão no servidor.

Força bruta na senha, credential stuffing, spraying, adivinhação de sessão e replay de cookie foram executados contra os dois servidores. Os casos que dependem de controles inexistentes na referência foram executados apenas na API. Entre eles estão: força bruta no TOTP, tentativas simultâneas, contorno do limite por IP, fixação de sessão, origem do logout, novo login e expiração. "Depois" designa a API do projeto, sem nenhuma alteração.

### 3.3 Execução dos testes

A suíte `api/tests/seguranca.test.ts` usa o executor `bun test`. Ela sobe os dois servidores em portas locais, cria um banco SQLite temporário e zera os contadores de tentativas entre os casos. Para cada caso, observa códigos HTTP, emissão de cookie, acesso ao perfil e, quando preciso, o conteúdo do banco. Os logs vão para `evidencias/`, com e-mails, tokens, códigos e segredos mascarados. As senhas fictícias usadas para testar a política aparecem em claro, e os identificadores de sessão são exibidos até o sexto caractere. O Apêndice C explica como reproduzir.

## 4 Sistema avaliado e controles implementados

### 4.1 Arquitetura

| Componente | Responsabilidade |
| --- | --- |
| Interface web (React, TypeScript, Vite) | Cadastro, login, QR Code para o autenticador e painel de perfil |
| API (Bun 1.3.14, Elysia) | Validação, autenticação, limitação de tentativas e sessões (`api/src/routes`, `api/src/services`) |
| Banco (SQLite) | Tabelas `users`, `sessions` e `auth_attempts` |
| Configuração (`api/src/config.ts`) | `WEB_ORIGIN`, `DATA_DIRECTORY`, prazos de sessão e bloqueio, `NODE_ENV` para o atributo Secure |

### 4.2 Atendimento aos requisitos do trabalho

| Requisito do trabalho | Implementação | Situação |
| --- | --- | --- |
| Cadastro e login com hash bcrypt/Argon2 | Argon2id (BIRYUKOV et al., 2021) com m = 64 MiB, t = 2, p = 1, via `Bun.password.hash` | Atendido |
| Política de senhas fortes | 8 a 128 caracteres com maiúscula, minúscula e dígito; aceita senhas comuns como "Senha123" | Parcial |
| MFA via TOTP | RFC 6238 (M'RAIHI et al., 2011), HMAC-SHA1, 6 dígitos, período de 30 s, tolerância de ±1 período; exigido no login | Parcial (A-01, A-04) |
| Rate limiting e bloqueio temporário | 5 falhas por e-mail ou 20 por IP em 15 min geram bloqueio de 15 min, com HTTP 429 e `Retry-After` | Parcial (A-02, A-12) |
| CAPTCHA | Não implementado | Ausente |
| Cookies HttpOnly/Secure e expiração | HttpOnly, SameSite=Lax e prazo de 8 h verificado também no servidor; Secure só com `NODE_ENV=production` | Parcial (A-07) |
| Rotação de token | Novo token a cada login completo; o login revoga só o cookie enviado na própria requisição, e outras sessões da conta continuam válidas; sem renovação durante o uso | Parcial (A-10) |
| Testes de força bruta, credential stuffing e sequestro de sessão | 19 testes automatizados com logs | Atendido |
| Relatório antes/depois e trade-offs | Seções 5.6 e 7 | Atendido |

## 5 Testes e resultados

### 5.1 Força bruta contra a senha

Dicionário de 26 senhas comuns contra uma conta, com a senha correta na 25ª posição.

- Antes: a senha foi descoberta na tentativa 25.
- Depois: 5 respostas 401 e, em seguida, 21 respostas 429 com `Retry-After: 900`. A senha correta também recebeu 429.
- Simultâneas (apenas na API): 100 tentativas enviadas ao mesmo tempo receberam 99 respostas 401, uma 200 e nenhuma 429. A senha correta, na 99ª posição, foi confirmada. A tentativa seguinte, já sequencial, recebeu 429 (A-12).
- Evidências: `evidencias/forca-bruta.log`, `evidencias/concorrencia-forca-bruta.log`

### 5.2 Força bruta contra o TOTP

Senha correta conhecida e códigos TOTP errados. Executado apenas na API.

- Depois: 5 respostas 401, seguidas de 429; o código correto, na 8ª tentativa, também recebeu 429. Com 5 tentativas a cada 15 minutos, 3 códigos aceitos por vez e 10⁶ combinações, a chance teórica de acerto em cada janela de 15 minutos é de cerca de 0,0015%.
- Evidência: `evidencias/forca-bruta-totp.log`

### 5.3 Credential stuffing

Lista de 30 pares e-mail/senha para 10 contas, com 10 pares válidos (reúso de senha).

- Antes: 10 sessões abertas.
- Depois: nenhuma sessão, mas as 10 senhas corretas foram confirmadas pela resposta `requiresTotp`. Nenhuma resposta 429 ocorreu, porque cada senha correta zerou o contador do IP (A-02).
- Evidência: `evidencias/credential-stuffing.log`

### 5.4 Password spraying e limite por IP

Uma senha errada contra 25 e-mails sem cadastro, a partir do mesmo IP.

- Antes: 25 respostas 401, nenhum bloqueio.
- Depois: 20 respostas 401 e bloqueio (429) a partir da 21ª.
- Contorno (apenas na API): o atacante enviou a senha correta da própria conta a cada 19 tentativas, sem concluir o TOTP. Assim, 60 tentativas erradas passaram sem nenhum 429.
- Evidências: `evidencias/limite-ip.log`, `evidencias/contorno-limite-ip.log`

### 5.5 Sequestro de sessão

| Ataque | Antes | Depois | Evidência |
| --- | --- | --- | --- |
| Adivinhar o identificador | 13 sessões válidas entre os identificadores 1 a 50 (12 abertas nos testes anteriores e uma no próprio teste) | Nenhum acerto em 200 tokens aleatórios | `adivinhacao-sessao.log` |
| Proteção do cookie contra leitura por script (atributo HttpOnly no Set-Cookie) | Ausente | `HttpOnly; SameSite=Lax; Max-Age=28800` | `cookie-atributos.log` |
| Reusar cópia do cookie durante a sessão | 200 | 200 (limitação de todo token portador) | `sequestro-sessao.log` |
| Reusar a cópia após o logout | 200 | 401 | `sequestro-sessao.log` |
| Novo login enviando o cookie anterior | não testado | 401 para o token anterior | `sequestro-sessao.log` |
| Usar sessão expirada | sessões sem prazo | 401 | `sequestro-sessao.log` |
| Fixação (identificador plantado antes do login) | não testado | ignorado; o valor plantado recebe 401 | `fixacao-csrf.log` |
| Logout disparado de outra origem | não testado | 403 sem `Origin` e com origem externa | `fixacao-csrf.log` |

### 5.6 Comparação antes × depois

| Cenário | Antes | Depois |
| --- | --- | --- |
| Armazenamento da senha | SHA-256 sem sal, qualquer senha não vazia aceita | Argon2id; política de composição |
| Força bruta na senha | Descoberta na 25ª tentativa | 5 × 401, depois 429 |
| Força bruta com 100 requisições simultâneas | Não testado; a referência não tem bloqueio | 99 × 401, 1 × 200 (senha confirmada), nenhum 429 |
| Credential stuffing | 10 sessões | 0 sessões; 10 senhas confirmadas |
| Spraying de um IP | 25 × 401, sem bloqueio | Bloqueio na 21ª tentativa |
| Adivinhação de sessão | 13 em 50 | 0 em 200 |
| Replay durante a sessão | 200 | 200 |
| Replay após logout | 200 | 401 |

Fonte: `evidencias/resumo-antes-depois.md`, gerado pela suíte.

## 6 Achados

### 6.1 Resumo dos achados

| ID | Achado | Severidade (CVSS 3.1) | Comprovação |
| --- | --- | --- | --- |
| A-01 | Tomada de conta com MFA pendente | Alta (7,4) | Teste |
| A-03 | Rotas auxiliares de hash públicas | Alta (7,5, estimada) | Parcial: acesso e carga por teste; indisponibilidade estimada |
| A-04 | Código TOTP reutilizável | Média (6,8) | Teste |
| A-05 | Origem não verificada no cadastro, login e ativação | Média (6,3) | Parcial: servidor por teste; navegador não testado |
| A-06 | Segredo TOTP em texto claro no banco | Média (6,0) | Teste |
| A-07 | Cookie sem Secure fora de produção e cache de respostas sensíveis | Média (5,9) | Parcial: cookie por teste; cache por inspeção |
| A-02 | Login correto zera o limite por IP | Média (5,3) | Teste |
| A-12 | Requisições simultâneas contornam o bloqueio por conta | Média (5,3) | Teste |
| A-08 | Enumeração de contas | Média (5,3) | Parcial: cadastro e login por teste; CPF por inspeção |
| A-09 | Bloqueio da conta provocado por terceiros | Média (5,3) | Teste |
| A-10 | Sessão sem prazo de inatividade e sem renovação | Baixa (3,7) | Parcial: replay por teste; ausência de prazo por inspeção |
| A-11 | Erros internos e metadados de imagem | Baixa (3,7) | Parcial: erro por teste; metadados por inspeção |

### 6.2 Detalhamento

Todas as fichas têm status Aberto: nenhuma correção foi aplicada ao código avaliado.

#### A-01 Tomada de conta com MFA pendente

| Campo | Conteúdo |
| --- | --- |
| Severidade | Alta (7,4) |
| Vetor CVSS 3.1 | `CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:N` |
| Local | `api/src/services/auth.service.ts` (`loginUser`) |
| Descrição | Enquanto o usuário não confirma o TOTP, `POST /auth/login` sem código devolve o segredo pendente a quem informar a senha correta. Quem enviar um código gerado com esse segredo ativa o MFA e recebe uma sessão. |
| Cenário | O atacante obtém a senha de uma conta recém-criada, por vazamento ou credential stuffing. Em seguida, ativa o TOTP no próprio celular e passa a controlar o segundo fator da vítima. |
| Evidência | `evidencias/mfa-pendente.log`: login sem código → 200 com o segredo; código do atacante → 200 com sessão. |
| Correção | Entregar o segredo uma única vez, no cadastro, e expirar a ativação pendente após poucos minutos; na retomada, exigir confirmação por um canal do titular, como o e-mail. |
| Referências | CWE-287 (Improper Authentication) |

#### A-02 Login correto zera o limite por IP

| Campo | Conteúdo |
| --- | --- |
| Severidade | Média (5,3) |
| Vetor CVSS 3.1 | `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N` |
| Local | `api/src/services/auth-attempt.service.ts` (`clearAuthFailures`), `api/src/services/auth.service.ts` |
| Descrição | Após uma senha correta, `clearAuthFailures` apaga os contadores do e-mail e também do IP. A resposta `requiresTotp` revela quando a senha está correta, mesmo sem abrir sessão. Além disso, login (`login-password`) e ativação (`totp-activation-password`) têm contadores separados, o que permite 10 tentativas de senha por conta em vez de 5. |
| Cenário | O atacante envia a senha correta da própria conta a cada 19 tentativas contra outras contas; o IP nunca chega a 20 falhas. A confidencialidade afetada é a confirmação de senhas, classificada como baixa porque o segundo fator impediu a abertura de sessões. Combinado com A-01, o impacto sobe para o de A-01. |
| Evidência | `evidencias/contorno-limite-ip.log` (60 falhas, nenhum 429); `evidencias/credential-stuffing.log` (10 senhas confirmadas, 0 sessões) |
| Correção | Limpar apenas o contador do e-mail após sucesso e deixar o do IP expirar com a janela; unificar os contadores de senha do login e da ativação. |
| Referências | CWE-307 (Improper Restriction of Excessive Authentication Attempts); ASVS 2.2.1 |

#### A-03 Rotas auxiliares de hash públicas

| Campo | Conteúdo |
| --- | --- |
| Severidade | Alta (7,5, estimada) |
| Vetor CVSS 3.1 | `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H` |
| Local | `api/src/routes/password.routes.ts`, registrado em `api/src/app.ts` |
| Descrição | `POST /auth/encrypt` gera hash bcrypt com custo 4 e `POST /auth/verify` verifica qualquer hash enviado pelo cliente, ambas sem autenticação e sem limite de tentativas. |
| Cenário | Um cliente anônimo envia a `/auth/verify` hashes bcrypt de custo elevado. O custo dobra a cada unidade e a aplicação não impõe teto próprio, então poucas requisições podem ocupar o processador por muito tempo e atrasar o login dos usuários. O teste usou custo 14. O `A:H` pressupõe a indisponibilidade, que não foi provocada no teste; se ela não se confirmar, o achado cai para Média.
| Evidência | `evidencias/rotas-auxiliares.log`: as duas rotas responderam 200 sem sessão; hash com prefixo `$2b$04$`. `evidencias/rotas-auxiliares-carga.log`: 4 requisições anônimas com custo 14 foram concluídas em 767 ms no total; numa máquina de 12 CPUs, o login passou de 79 ms para 100 ms durante a carga. |
| Correção | Remover `passwordRoutes` da aplicação. |
| Referências | CWE-400 (Uncontrolled Resource Consumption) |

#### A-04 Código TOTP reutilizável

| Campo | Conteúdo |
| --- | --- |
| Severidade | Média (6,8) |
| Vetor CVSS 3.1 | `CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:H/I:H/A:N` |
| Local | `api/src/services/totp.service.ts` (`verifyTotp`) |
| Descrição | O verificador não registra o último período aceito. Com a tolerância de ±1 período de 30 s, o mesmo código é aceito em vários logins por até 90 s. |
| Cenário | Um atacante que já conhece a senha captura o código digitado pela vítima (phishing em tempo real ou observação da tela) e o reutiliza para abrir uma sessão paralela. |
| Evidência | `evidencias/replay-totp.log`: o mesmo código recebeu 200 em dois logins. O acesso ao perfil com as duas sessões não foi verificado. |
| Correção | Guardar por usuário o último contador aceito e rejeitar contador igual ou menor, com atualização atômica. |
| Referências | CWE-294 (Authentication Bypass by Capture-replay); ASVS 2.8.4 |

#### A-05 Origem não verificada no cadastro, login e ativação

| Campo | Conteúdo |
| --- | --- |
| Severidade | Média (6,3) |
| Vetor CVSS 3.1 | `CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:L/A:L` |
| Local | `api/src/routes/auth.routes.ts` |
| Descrição | Logout, CPF e avatar conferem o cabeçalho `Origin`; cadastro, login e ativação do TOTP não. |
| Cenário | Uma página maliciosa envia um formulário de login com as credenciais do atacante e deixa a vítima autenticada na conta dele (login CSRF). A mesma técnica pode provocar o bloqueio da conta da vítima. O comportamento do navegador não foi testado.
| Evidência | `evidencias/origem-login.log`: login enviado como formulário (`application/x-www-form-urlencoded`) com `Origin: https://atacante.example` recebeu 200 e cookie de sessão. O logout, por outro lado, rejeita origem externa (`evidencias/fixacao-csrf.log`). |
| Correção | Aplicar a verificação de origem a todas as rotas que alteram estado e exigir `Content-Type: application/json`. |
| Referências | CWE-352 (Cross-Site Request Forgery) |

#### A-06 Segredo TOTP em texto claro no banco

| Campo | Conteúdo |
| --- | --- |
| Severidade | Média (6,0) |
| Vetor CVSS 3.1 | `CVSS:3.1/AV:L/AC:L/PR:H/UI:N/S:U/C:H/I:H/A:N` |
| Local | `api/src/database/schema.ts`, `api/src/repositories/user.repository.ts` |
| Descrição | `totp_secret` e `pending_totp_secret` são gravados em Base32 sem cifra. |
| Cenário | Quem obtiver uma cópia do arquivo SQLite ou de um backup gera códigos válidos para todas as contas. |
| Evidência | `evidencias/armazenamento.log`: segredo de 32 caracteres Base32 lido diretamente da tabela. |
| Correção | Cifrar os segredos com AES-256-GCM, com chave fora do banco (variável de ambiente ou cofre). |
| Referências | CWE-312 (Cleartext Storage of Sensitive Information); ASVS 2.8.2 |

#### A-07 Cookie sem Secure fora de produção e cache de respostas sensíveis

| Campo | Conteúdo |
| --- | --- |
| Severidade | Média (5,9) |
| Vetor CVSS 3.1 | `CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:N/A:N` |
| Local | `api/src/config.ts`, `api/src/utils/session-cookie.ts`, `api/src/routes/auth.routes.ts` |
| Descrição | `Secure` só é ativado com `NODE_ENV=production`. Apenas `GET /auth/avatar` envia `Cache-Control: private, no-store`; respostas com dados do perfil e com o segredo TOTP não. |
| Cenário | Uma implantação sem `NODE_ENV=production` envia o cookie também por HTTP, onde pode ser interceptado. |
| Evidência | `evidencias/cookie-atributos.log` (cookie emitido sem Secure no ambiente local); cache por inspeção. |
| Correção | Ativar Secure por padrão, desativando apenas em desenvolvimento; usar HSTS; aplicar `Cache-Control: no-store` às respostas de `/auth/*`. |
| Referências | CWE-614 (Sensitive Cookie in HTTPS Session Without 'Secure' Attribute); CWE-525; ASVS 3.4.1 |

#### A-08 Enumeração de contas

| Campo | Conteúdo |
| --- | --- |
| Severidade | Média (5,3) |
| Vetor CVSS 3.1 | `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N` |
| Local | `api/src/services/auth.service.ts`, `api/src/services/profile.service.ts` |
| Descrição | O cadastro responde 409 para e-mail ou RA já usados. No login, quando o e-mail não existe, o Argon2id não é executado e a resposta sai muito mais rápido. A gravação de CPF também informa quando o documento pertence a outra conta. |
| Cenário | O atacante descobre quais e-mails têm conta antes de tentar senhas. |
| Evidência | `evidencias/enumeracao.log`: 409 no cadastro e tempos de resposta no login, em 8 medições por condição, com valor central de 65,2 ms para e-mail existente e 0,3 ms para inexistente. A suíte registra o 5º dos 8 valores ordenados. A resposta do CPF foi verificada por inspeção. |
| Correção | Executar a verificação contra um hash fictício quando o usuário não existe (OWASP, [2026]a); responder de forma genérica no cadastro; limitar tentativas de cadastro e de gravação de CPF. |
| Referências | CWE-204 (Observable Response Discrepancy); CWE-208 (Observable Timing Discrepancy) |

#### A-09 Bloqueio da conta provocado por terceiros

| Campo | Conteúdo |
| --- | --- |
| Severidade | Média (5,3) |
| Vetor CVSS 3.1 | `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L` |
| Local | `api/src/services/auth-attempt.service.ts` |
| Descrição | Cinco senhas erradas bloqueiam a conta por 15 minutos, inclusive para o dono, que recebe 429 mesmo com a senha correta. |
| Cenário | Um terceiro mantém a conta da vítima bloqueada repetindo 5 falhas a cada 15 minutos. |
| Evidência | `evidencias/forca-bruta.log`: a senha correta recebeu 429 durante o bloqueio. |
| Correção | Atraso progressivo em vez de bloqueio fixo e CAPTCHA após algumas falhas. |
| Referências | CWE-645 (Overly Restrictive Account Lockout Mechanism) |

#### A-10 Sessão sem prazo de inatividade e sem renovação

| Campo | Conteúdo |
| --- | --- |
| Severidade | Baixa (3,7) |
| Vetor CVSS 3.1 | `CVSS:3.1/AV:N/AC:H/PR:L/UI:R/S:U/C:L/I:L/A:N` |
| Local | `api/src/services/session.service.ts` |
| Descrição | A sessão tem prazo absoluto de 8 h, dentro das 12 h que o ASVS 3.3.2 aceita no nível 2. Falta o limite de 30 minutos de inatividade que o mesmo requisito exige nesse nível. O token também não é renovado durante o uso e não há opção de encerrar todas as sessões da conta. |
| Cenário | Um cookie copiado em computador compartilhado continua válido por até 8 h, mesmo sem uso. |
| Evidência | `evidencias/sequestro-sessao.log` mostra o replay aceito enquanto a sessão vale; a ausência de prazo de inatividade foi verificada por inspeção. |
| Correção | Prazo de inatividade de 30 min, renovação do token em intervalos ou ações sensíveis e revogação de todas as sessões do usuário (OWASP, [2026]b). |
| Referências | CWE-613 (Insufficient Session Expiration); ASVS 3.3.2 |

#### A-11 Erros internos e metadados de imagem

| Campo | Conteúdo |
| --- | --- |
| Severidade | Baixa (3,7) |
| Vetor CVSS 3.1 | `CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:N/A:N` |
| Local | `api/src/plugins/error-handler.ts`, rota `POST /auth/avatar` em `api/src/routes/auth.routes.ts` |
| Descrição | O tratador de erros só formata `HttpError`; outros erros ficam com a resposta padrão do framework, que pode expor detalhes internos. O avatar é guardado com os bytes originais, inclusive metadados EXIF, que podem conter localização. As duas falhas expõem informação pouco sensível, por isso compartilham o vetor. |
| Evidência | `evidencias/erro-interno.log`: hash inválido em `/auth/verify` retornou 500 com a mensagem interna `Password verification failed with error "UnsupportedAlgorithm"`. Metadados da imagem por inspeção. |
| Correção | Resposta genérica 500 para erros inesperados e recodificação da imagem no servidor. |
| Referências | CWE-209 (Generation of Error Message Containing Sensitive Information) |

#### A-12 Requisições simultâneas contornam o bloqueio por conta

| Campo | Conteúdo |
| --- | --- |
| Severidade | Média (5,3) |
| Vetor CVSS 3.1 | `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N` |
| Local | `api/src/services/auth.service.ts` (`authenticate`) |
| Descrição | `assertAuthAttemptAllowed` consulta o contador antes da verificação, mas `recordAuthFailure` só grava a falha depois de `await Bun.password.verify`. Enquanto as verificações estão em andamento, todas as requisições encontram o contador zerado (condição de corrida entre checagem e uso). |
| Cenário | O atacante envia as tentativas em lotes simultâneos. No lote testado, nenhuma das 100 requisições recebeu 429; só a requisição seguinte, já sequencial, foi bloqueada. Lotes posteriores não foram testados. Em conta com TOTP ativo, o atacante descobre a senha; em conta com MFA pendente, a senha descoberta leva a A-01. |
| Evidência | `evidencias/concorrencia-forca-bruta.log`: 100 tentativas simultâneas receberam 99 respostas 401, uma 200 e nenhuma 429; a senha correta foi confirmada. A tentativa seguinte, sequencial, recebeu 429. |
| Correção | Registrar a falha antes do `await` (reserva) e removê-la quando a senha estiver correta, ou serializar as tentativas por conta. |
| Referências | CWE-367 (Time-of-check Time-of-use Race Condition); CWE-307; ASVS 2.2.1 |

### 6.3 Observações sem classificação de risco

A conexão com o SQLite (`api/src/database/connection.ts`) não executa `PRAGMA foreign_keys = ON`. Por isso, o `ON DELETE CASCADE` declarado em `sessions` não tem efeito, e a exclusão de um usuário deixaria sessões órfãs. Hoje a API não exclui usuários, então não há impacto de segurança observável.

O cadastro limita a senha a 128 caracteres, mas o login e a ativação aceitam senhas até o limite global de 2,2 MB do corpo. A medição não mostrou custo adicional: 75 ms com uma senha de 2.000.000 caracteres contra 80 ms com uma senha comum (`evidencias/senha-longa.log`). Ainda assim, aplicar o mesmo limite no login evita processamento desnecessário.

## 7 Trade-offs entre usabilidade e segurança

| Decisão | Benefício | Custo ou risco |
| --- | --- | --- |
| Política com maiúscula, minúscula e dígito | Segurança: rejeita senhas com menos de oito caracteres e as que não atendem às regras de composição | Usabilidade: atrapalha frases-senha. Segurança: ainda aceita "Senha123". O ASVS 2.1.9 e o NIST SP 800-63B-4 desaconselham regras de composição; o ASVS 2.1.1 pede no mínimo 12 caracteres e o 2.1.7, bloqueio de senhas vazadas. |
| Bloqueio de 15 min após 5 falhas | Segurança: interrompe força bruta | Usabilidade: o dono da conta também fica bloqueado. Segurança: um terceiro pode provocar o bloqueio de propósito (A-09). |
| CAPTCHA não implementado | Usabilidade: fluxo sem atrito e acessível | Segurança: menos defesa contra automação; item do enunciado em aberto. Um CAPTCHA exibido só após algumas falhas teria baixo custo de uso. |
| TOTP obrigatório | Segurança: em contas com TOTP já ativado, a senha vazada não basta para entrar | Usabilidade: exige celular com autenticador; sem códigos de recuperação, perder o aparelho bloqueia o acesso. |
| Sessão de 8 h sem prazo de inatividade | Usabilidade: menos logins durante o dia | Segurança: um cookie copiado vale por mais tempo (A-10). |

## 8 Considerações finais

O sistema implementa os controles centrais exigidos pelo trabalho: Argon2id, TOTP, limitação de tentativas e sessões com cookie HttpOnly. Em contas com TOTP ativo, credenciais vazadas não abriram nenhuma sessão. Nenhuma de 200 tentativas de adivinhar um token de sessão acertou. O logout invalidou as cópias do cookie. O bloqueio de tentativas, porém, não conteve 100 requisições simultâneas (A-12).

Ordem de correção recomendada:

1. Proteger a ativação pendente do TOTP (A-01).
2. Registrar a falha antes da verificação da senha (A-12).
3. Remover as rotas auxiliares de hash (A-03).
4. Preservar o contador do IP e unificar os contadores de senha (A-02).
5. Impedir o reúso do código TOTP (A-04).
6. Cifrar os segredos TOTP (A-06).

Itens do enunciado ainda pendentes: CAPTCHA, Secure por padrão e renovação do token durante a sessão.

## Referências

AGUIAR, Matheus Felipe de. **autenticacao**. [S. l.]: GitHub, 2026. Disponível em: https://github.com/Matheus336/autenticacao. Acesso em: 24 nov. 2026.

ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. **NBR 10719**: informação e documentação: relatório técnico e/ou científico: apresentação. Rio de Janeiro: ABNT, 2015.

BIRYUKOV, Alex et al. **Argon2 memory-hard function for password hashing and proof-of-work applications**. RFC 9106. [S. l.]: IRTF, 2021. Disponível em: https://www.rfc-editor.org/rfc/rfc9106. Acesso em: 24 nov. 2026.

FIRST. **Common Vulnerability Scoring System v3.1**: specification document. [S. l.]: FIRST, 2019. Disponível em: https://www.first.org/cvss/v3.1/specification-document. Acesso em: 24 nov. 2026.

M'RAIHI, David et al. **TOTP**: time-based one-time password algorithm. RFC 6238. [S. l.]: IETF, 2011. Disponível em: https://www.rfc-editor.org/rfc/rfc6238. Acesso em: 24 nov. 2026.

NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY. **Digital identity guidelines**: authentication and authenticator management. NIST SP 800-63B-4. Gaithersburg: NIST, 2025. Disponível em: https://pages.nist.gov/800-63-4/sp800-63b.html. Acesso em: 24 nov. 2026.

OWASP. **Application Security Verification Standard 4.0.3**. [S. l.]: OWASP, 2021. Disponível em: https://github.com/OWASP/ASVS/releases/tag/v4.0.3_release. Acesso em: 24 nov. 2026.

OWASP. **Web Security Testing Guide v4.2**: reporting. [S. l.]: OWASP, 2020. Disponível em: https://wstg.owasp.org/v4.2/5-Reporting/. Acesso em: 24 nov. 2026.

OWASP. **Authentication cheat sheet**. [S. l.]: OWASP, [2026]a. Disponível em: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html. Acesso em: 24 nov. 2026.

OWASP. **Session management cheat sheet**. [S. l.]: OWASP, [2026]b. Disponível em: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html. Acesso em: 24 nov. 2026.

## Apêndice A — Escala de severidade

A severidade segue a escala qualitativa do CVSS 3.1 (FIRST, 2019) aplicada à nota-base do vetor.

| Nota-base | Severidade |
| --- | --- |
| 0,0 | Nenhuma |
| 0,1 a 3,9 | Baixa |
| 4,0 a 6,9 | Média |
| 7,0 a 8,9 | Alta |
| 9,0 a 10,0 | Crítica |

## Apêndice B — Checklist de verificação (OWASP ASVS 4.0.3, nível 2)

| Requisito | Verificação | Resultado | Evidência |
| --- | --- | --- | --- |
| 2.1.1 Senha com no mínimo 12 caracteres | Validador do cadastro | Não atende (mínimo 8) | `api/src/validators/auth.validators.ts` |
| 2.1.7 Bloquear senhas vazadas ou comuns | Cadastro com "Senha123" | Não atende (201) | `armazenamento.log` |
| 2.1.9 Sem regras de composição | Validador do cadastro | Não atende (exige maiúscula, minúscula e dígito) | `api/src/validators/auth.validators.ts` |
| 2.2.1 Antiautomação contra força bruta e credenciais vazadas | Força bruta, stuffing, spraying | Parcial (bloqueio funciona em sequência; contornado por IP e por requisições simultâneas) | `forca-bruta.log`, `contorno-limite-ip.log`, `concorrencia-forca-bruta.log` |
| 2.4.1 Hash resistente a ataque offline | Hash lido do banco | Atende (Argon2id) | `armazenamento.log` |
| 2.8.1 OTP com validade definida | Período de 30 s com tolerância de ±1 | Atende | `api/src/services/totp.service.ts` |
| 2.8.2 Chave do OTP protegida | Segredo lido do banco | Não atende (texto claro) | `armazenamento.log` |
| 2.8.4 OTP usado uma única vez | Mesmo código em dois logins | Não atende | `replay-totp.log` |
| 3.2.1 Novo token na autenticação | Login com identificador plantado | Atende | `fixacao-csrf.log` |
| 3.2.2 Token com no mínimo 64 bits de entropia | `randomBytes(32)` no código; token de 43 caracteres no cookie | Atende (256 bits) | `api/src/services/session.service.ts`, `cookie-atributos.log` |
| 3.3.1 Logout e expiração invalidam o token | Replay após logout e expiração | Atende | `sequestro-sessao.log` |
| 3.3.2 Reautenticação em 12 h ou após 30 min de inatividade | Serviço de sessão | Parcial (8 h absolutas; sem prazo de inatividade) | `api/src/services/session.service.ts` |
| 3.4.1 Cookie com Secure | Set-Cookie local; configuração | Parcial (só com `NODE_ENV=production`) | `cookie-atributos.log`, `api/src/config.ts` |
| 3.4.2 Cookie com HttpOnly | Set-Cookie | Atende | `cookie-atributos.log` |
| 3.4.3 Cookie com SameSite | Set-Cookie | Atende (Lax) | `cookie-atributos.log` |

## Apêndice C — Evidências e reprodução

Para reproduzir, com Bun 1.3.14 instalado, a partir da raiz do repositório:

```bash
cd api
bun install --frozen-lockfile
bun test tests/
```

A execução regrava os arquivos de `evidencias/`. Os tempos de resposta dos achados A-03 e A-08 e da seção 6.3 variam a cada execução.

| Arquivo em `evidencias/` | Conteúdo |
| --- | --- |
| `resumo-antes-depois.md` | Tabela consolidada antes × depois |
| `forca-bruta.log` | Dicionário de 26 senhas contra uma conta |
| `forca-bruta-totp.log` | Força bruta no código TOTP |
| `credential-stuffing.log` | 30 pares, 10 válidos |
| `limite-ip.log` | 25 e-mails sem cadastro, uma tentativa cada |
| `contorno-limite-ip.log` | Achado A-02 |
| `cookie-atributos.log` | Atributos do Set-Cookie |
| `adivinhacao-sessao.log` | Adivinhação de identificador de sessão |
| `sequestro-sessao.log` | Replay, logout, novo login e expiração |
| `fixacao-csrf.log` | Fixação de sessão e origem do logout |
| `armazenamento.log` | Hash da senha, segredo TOTP e política |
| `rotas-auxiliares.log` | Achado A-03 |
| `replay-totp.log` | Achado A-04 |
| `mfa-pendente.log` | Achado A-01 |
| `enumeracao.log` | Achado A-08 |
| `concorrencia-forca-bruta.log` | Achado A-12 |
| `rotas-auxiliares-carga.log` | Achado A-03, carga |
| `origem-login.log` | Achado A-05 |
| `erro-interno.log` | Achado A-11 |
| `senha-longa.log` | Observação da seção 6.3 |
