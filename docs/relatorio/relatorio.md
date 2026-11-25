# Trabalho Prático 1 — Projeto 3 · Autenticação segura e gestão de identidades

| Campo | Identificação |
| --- | --- |
| Instituição | Universidade Tecnológica Federal do Paraná (UTFPR) |
| Disciplina | SA28S — Segurança e Auditoria em Sistemas |
| Professor | Erinaldo da Silva Pereira |
| Integrantes | [preencher] |
| Data | 25/11/2026 |

## Sumário executivo

A API exigiu o segundo fator para abrir sessões de contas com TOTP ativo, bloqueou tentativas consecutivas de senha e revogou o cookie no logout. A proteção depende, porém, do estado da conta e da sessão. O teste de cadastro incompleto mostrou que a posse da senha permitiu assumir a ativação do autenticador. O teste de sessão mostrou que uma cópia do cookie deu acesso ao perfil enquanto a sessão estava válida. Os resultados abaixo comparam a API com o servidor de referência construído para o laboratório. [Resumo da execução](../../evidencias/resumo-antes-depois.md)

- **Força bruta de senha.** A referência abriu sessão na 25ª tentativa. A API respondeu com 5 recusas HTTP 401 e 21 bloqueios HTTP 429, inclusive para a senha correta.
- **Reutilização de credenciais.** Entre 30 pares de e-mail e senha, os 10 válidos abriram 10 sessões na referência e nenhuma na API. A resposta da API confirmou as 10 senhas.
- **Limite por IP.** Na API, a primeira série de falhas consecutivas recebeu bloqueio na 21ª tentativa. Em outra série, com autenticações válidas intercaladas, ocorreram 60 falhas sem bloqueio por IP.
- **Adivinhação de sessão.** A referência reconheceu 13 identificadores entre 50 candidatos sequenciais. A API reconheceu 0 entre 200 candidatos aleatórios.

## Objetivo e escopo

A avaliação verifica em que condições o módulo protege a entrada na conta e o acesso posterior ao perfil. A matriz adota as entregas do Projeto 3 como critério. “Parcial” indica uma lacuna no controle implementado ou em sua cobertura. [Enunciado do trabalho](../enunciado_tp1.txt)

| Item do Projeto 3 | Status | Implementação ou verificação |
| --- | --- | --- |
| Cadastro, login, hash e política de senhas | Parcial | Cadastro e verificação com Argon2id atendem ao requisito de hash. A política rejeitou uma senha curta, mas aceitou uma senha comum que satisfaz as regras de composição. [Armazenamento](../../evidencias/armazenamento.log) |
| MFA por TOTP | Parcial | O login de conta ativada exige o código. A vinculação pendente e o reuso de um código já aceito comprometem o ciclo do fator. [Ativação pendente](../../evidencias/mfa-pendente.log) · [Reuso do código](../../evidencias/replay-totp.log) |
| Proteção contra força bruta com limitação e bloqueio temporário | Parcial | O bloqueio funcionou por conta e por IP em séries de falhas consecutivas. O histórico agregado do IP foi perdido na série mista. [Bloqueio por conta](../../evidencias/forca-bruta.log) · [Contador por IP](../../evidencias/contorno-limite-ip.log) |
| CAPTCHA, componente da proteção contra força bruta | Ausente | Os formulários e o fluxo de autenticação da API não apresentam nem validam um desafio. [Fluxo de login](../../web/src/hooks/loginFlow.ts) · [Serviço de autenticação](../../api/src/services/auth.service.ts) |
| Sessões com cookies HttpOnly/Secure, expiração e rotação | Parcial | Há HttpOnly, prazo absoluto e substituição do identificador no login. Secure depende do ambiente. Durante a sessão faltam rotação periódica e expiração por inatividade. [Cookie](../../evidencias/cookie-atributos.log) · [Ciclo da sessão](../../evidencias/sequestro-sessao.log) |
| Simulações de força bruta, credential stuffing e sequestro de sessão com evidências | Atendido | A suíte registrou recusas, bloqueios, emissão e reuso de cookies em contas fictícias. [Índice das evidências](../../evidencias/README.md) |
| Relatório comparativo e discussão de usabilidade | Atendido | As seções de comparação e de trade-offs vinculam os resultados ao custo dos controles para quem usa o sistema. |

## Metodologia e reprodução

O OWASP ASVS 4.0.3 orientou a análise da autenticação (V2) e do gerenciamento de sessão (V3). A NIST SP 800-63B orientou a avaliação de senhas, vinculação de autenticadores e uso único do código. O OWASP WSTG orientou a seleção dos casos de teste. A cobertura se restringe aos controles da matriz. [ASVS 4.0.3](https://github.com/OWASP/ASVS/releases/tag/v4.0.3_release) · [NIST SP 800-63B](https://pages.nist.gov/800-63-4/sp800-63b.html) · [OWASP WSTG](https://wstg.owasp.org/v4.2/)

O grupo não dispunha de uma versão anterior da aplicação. Para obter uma linha de base executável, construiu o servidor de referência denominado **antes**. Ele mantém os dados em memória, usa SHA-256 sem sal para senhas, aceita login sem TOTP e emite sessões sequenciais. **Depois** designa a API do projeto. A comparação mede o efeito conjunto das diferenças entre as implementações. [Servidor de referência](../../api/tests/antes/servidor-inseguro.ts) · [API avaliada](../../api/src/app.ts)

A suíte automatizada de `bun test` inicia ambos os servidores em portas locais atribuídas pelo sistema, cria um banco SQLite temporário e limpa os contadores de falhas entre os casos. Os testes observam respostas HTTP, emissão de cookie, acesso ao perfil e, quando necessário, o estado do banco. Uma resposta HTTP 200 que solicita TOTP indica que a senha foi aceita. A criação de sessão é verificada pela emissão do cookie. Os logs usam contas fictícias, abreviam e-mails e tokens e omitem códigos e segredos completos. O ensaio de política de senha identifica os exemplos sintéticos testados. [Suíte](../../api/tests/seguranca.test.ts) · [Ambiente e registro de evidências](../../api/tests/apoio.ts)

Para reproduzir em uma cópia de trabalho local, com Bun instalado, executar a partir da raiz do projeto. A suíte recria os logs e o resumo em `evidencias/` dessa cópia.

```sh
cd api
bun install --frozen-lockfile
bun test tests/seguranca.test.ts
```

## Arquitetura

| Componente | Responsabilidade |
| --- | --- |
| Interface web · React, TypeScript e Vite | Apresenta cadastro, login, QR para vincular o autenticador e painel de perfil. [Interface](../../web/src/App.tsx) · [Configuração TOTP](../../web/src/components/totp/TotpSetup.tsx) |
| API · Bun e Elysia | Recebe as requisições, aplica validações e coordena autenticação, limitação de tentativas e sessões. [Aplicação](../../api/src/app.ts) · [Rotas](../../api/src/routes/auth.routes.ts) |
| Persistência · SQLite | A tabela `users` reúne identidade, hash de senha, dados TOTP e perfil. As tabelas `sessions` e `auth_attempts` mantêm sessões e contadores de falhas. [Esquema](../../api/src/database/schema.ts) |
| Configuração | Define a origem web permitida, o diretório de dados, os prazos de bloqueio e sessão e a condição para usar Secure. [Configuração da API](../../api/src/config.ts) |

## Controles implementados

| Controle | Comportamento e alcance da evidência |
| --- | --- |
| Senha e hash | O cadastro exige de 8 a 128 caracteres, com maiúscula, minúscula e dígito. O serviço chama `Bun.password.hash` e verifica a senha no login. O hash lido do SQLite identifica **Argon2id, m = 64 MiB, t = 2, p = 1**. O cadastro rejeitou a amostra curta (400) e aceitou a amostra comum (201). [Validador](../../api/src/validators/auth.validators.ts) · [Serviço](../../api/src/services/auth.service.ts) · [Log](../../evidencias/armazenamento.log) |
| TOTP | O cadastro gera um segredo aleatório e uma URI para o autenticador. A validação aceita o intervalo de tempo atual e os adjacentes para acomodar diferenças de relógio. Com o fator ativo, a senha isolada conduz à solicitação do código. O teste com credenciais reutilizadas verificou a ausência de cookie nessa etapa. [Algoritmo](../../api/src/services/totp.service.ts) · [Fluxo de autenticação](../../api/src/services/auth.service.ts) · [Log](../../evidencias/credential-stuffing.log) |
| Limitação de tentativas | A API registra falhas por ação e por e-mail e, quando disponível, por IP. Os limites são 5 falhas por e-mail e 20 por IP, com janela e bloqueio de 15 minutos. O tratador devolve 429 e informa o prazo em `Retry-After`. [Contadores](../../api/src/services/auth-attempt.service.ts) · [Tratador HTTP](../../api/src/plugins/error-handler.ts) · [Por conta](../../evidencias/forca-bruta.log) · [Por IP](../../evidencias/limite-ip.log) |
| Sessão e cookie | O servidor gera um token aleatório de 256 bits e guarda seu hash SHA-256. O cookie `sid` tem `Path=/`, `HttpOnly`, `SameSite=Lax` e `Max-Age=28800`. O servidor também verifica a expiração. O logout revoga a sessão apresentada. Um novo login completo revoga o token recebido nessa requisição. [Sessão](../../api/src/services/session.service.ts) · [Cookie](../../api/src/utils/session-cookie.ts) · [Atributos observados](../../evidencias/cookie-atributos.log) · [Revogação](../../evidencias/sequestro-sessao.log) |
| Perfil e origem | A API exige sessão para ler o perfil e para gravar CPF ou avatar. As gravações e o logout conferem `Origin` contra `WEB_ORIGIN`. O teste demonstrou a negação de acesso ao perfil com sessão revogada e a rejeição do logout de origem indevida. A autorização das alterações de CPF e avatar foi verificada por inspeção. [Rotas de perfil e logout](../../api/src/routes/auth.routes.ts) · [Perfil após revogação](../../evidencias/sequestro-sessao.log) · [Origem no logout](../../evidencias/fixacao-csrf.log) |

## Testes e evidências

### Força bruta contra a senha

O ensaio comparou um dicionário de 26 senhas contra uma conta fictícia em cada servidor. **Antes**, a tentativa 25 abriu sessão. **Depois**, as primeiras 5 falhas receberam 401 e as 21 tentativas seguintes receberam 429 com `Retry-After` de 900 s. A senha correta, na mesma posição, encontrou a conta bloqueada. [Log de força bruta](../../evidencias/forca-bruta.log)

### Força bruta contra o TOTP

O caso avaliou o bloqueio do segundo fator quando a senha já era conhecida. **Antes**, a referência autenticava somente com senha e o ensaio de códigos era inaplicável. **Depois**, houve 5 respostas 401 para códigos incorretos. As tentativas 6 e 7 receberam 429 e a tentativa 8, com código correto, também recebeu 429. [Log de força bruta no TOTP](../../evidencias/forca-bruta-totp.log)

### Credential stuffing com credenciais reutilizadas

A suíte avaliou 30 pares sintéticos de e-mail e senha, dos quais 10 eram válidos, e contou as sessões emitidas. **Antes**, os 10 pares válidos abriram sessão. **Depois**, nenhum abriu sessão, mas as 10 respostas com `requiresTotp` distinguiram as senhas corretas. Nenhuma resposta 429 ocorreu nessa série, porque cada senha correta zerou o contador do IP. [Log de credential stuffing](../../evidencias/credential-stuffing.log) · [Resumo](../../evidencias/resumo-antes-depois.md)

### Password spraying e limite por IP

O teste distribuiu uma senha inválida entre 25 endereços de e-mail fictícios inexistentes a partir de um IP. **Antes**, as 25 respostas foram 401. **Depois**, houve 20 respostas 401 e as demais receberam 429 a partir da 21ª tentativa. Um ensaio adicional da API misturou resultados de autenticação no mesmo IP. Nessa condição, houve 60 falhas e nenhum 429. A diferença revela que o bloqueio depende da conservação do histórico de falhas do endereço. [Série de falhas](../../evidencias/limite-ip.log) · [Série com resultados mistos](../../evidencias/contorno-limite-ip.log)

### Sequestro de sessão por adivinhação

A suíte verificou quantos identificadores candidatos davam acesso ao perfil. **Antes**, 13 dos 50 candidatos sequenciais corresponderam a sessões válidas. **Depois**, nenhum dos 200 candidatos aleatórios de 256 bits deu acesso. Os conjuntos de candidatos diferem porque cada servidor usa um formato de identificador distinto. [Log de adivinhação](../../evidencias/adivinhacao-sessao.log)

### Sequestro de sessão por replay de cookie válido

O teste representou a posse de uma cópia do cookie por outro cliente e observou a resposta da consulta ao perfil. **Antes e depois**, o perfil retornou 200 enquanto a sessão estava ativa. O controle de acesso aceita a posse do token como prova da sessão. O ensaio começou com uma cópia disponível e não mediu a obtenção do cookie. [Log de replay](../../evidencias/sequestro-sessao.log)

### Logout e substituição da sessão no login

A suíte comparou o acesso com uma cópia do cookie após o encerramento da sessão. **Antes**, o perfil ainda retornou 200 após o logout. **Depois**, o logout retornou 200 e a consulta posterior com a cópia recebeu 401. No mesmo teste, um novo login com o cookie vigente retornou 200 e o identificador substituído passou a receber 401. A substituição no novo login foi medida somente na API. [Log do ciclo de sessão](../../evidencias/sequestro-sessao.log)

### Fixação de sessão e origem do logout

O teste verificou se o login preservava um identificador previamente escolhido pelo cliente. **Antes**, a suíte não mediu fixação nem origem do logout. **Depois**, o servidor emitiu outro identificador e o anterior recebeu 401. O logout sem origem e o logout de origem externa receberam 403. A sessão legítima permaneceu utilizável e o perfil retornou 200. [Log de fixação e origem](../../evidencias/fixacao-csrf.log)

### Expiração de sessão

O ensaio verificou se o prazo também era aplicado no servidor. **Antes**, a referência mantinha sessões em memória sem prazo, conforme o código. Não há medição de expiração nessa implementação. **Depois**, o teste colocou `expires_at` no passado no banco temporário e obteve 401 ao consultar o perfil. O cookie anunciou 28 800 s de validade. A suíte verificou a decisão de expiração sem aguardar 8 h. [Referência](../../api/tests/antes/servidor-inseguro.ts) · [Prazo do cookie](../../evidencias/cookie-atributos.log) · [Expiração no servidor](../../evidencias/sequestro-sessao.log)

## Comparação antes e depois

Síntese dos cenários do [resumo gerado pela suíte](../../evidencias/resumo-antes-depois.md).

| Cenário | Antes · referência | Depois · API do projeto |
| --- | --- | --- |
| Força bruta de senha | Acerto na 25ª tentativa | 5 × 401 e 21 × 429. A senha correta recebeu 429, com espera indicada de 900 s. |
| Força bruta no TOTP | A senha bastava | 5 × 401, seguidos de 429. Para 5 tentativas em 15 min e um espaço de 10⁶ códigos, o resumo estima aproximadamente 0,0015% de chance de acerto considerando os intervalos aceitos. A porcentagem é teórica. |
| Credential stuffing | 10 sessões em 30 pares | 0 sessões, 10 senhas confirmadas e 0 bloqueios por IP. |
| Spraying de um IP | 25 × 401 e nenhum 429 | 20 × 401 e 429 a partir da 21ª tentativa. |
| Persistência do limite por IP | Sem limite | Na série com 3 autenticações de senha bem-sucedidas, 60 falhas receberam 401 e nenhuma recebeu 429. |
| Atributos do cookie | Identificador numérico, apenas `Path=/`, sem prazo explícito | Token de 256 bits, HttpOnly, SameSite=Lax e Max-Age de 28 800 s. Secure depende do modo de produção. |
| Adivinhação de sessão | 13 identificadores válidos entre 50 candidatos | 0 válidos entre 200 candidatos aleatórios. |
| Replay de cookie | 200 durante a sessão e após o logout | 200 durante a sessão. A cópia recebeu 401 após logout, substituição no login ou expiração. |
| Fixação e origem do logout | Sem ensaio correspondente | Identificador prévio rejeitado com 401. Origem ausente ou externa recebeu 403 no logout. |
| Armazenamento e política de senha | SHA-256 sem sal e aceitação de qualquer senha não vazia | Argon2id com 64 MiB, t = 2 e p = 1. Política de 8 a 128 caracteres com maiúscula, minúscula e dígito. A amostra comum foi aceita. |

## Achados e recomendações

As severidades e os vetores-base CVSS 3.1 adotam os cenários de impacto da revisão técnica. **Comprovado por teste** qualifica o comportamento registrado no log citado. **Identificado por inspeção** indica que a conclusão deriva do código. Em achados com ambas as fontes, o texto delimita o alcance de cada uma. [Especificação do CVSS 3.1](https://www.first.org/cvss/v3.1/specification-document)

### Vinculação do TOTP em cadastro pendente

**Alta · Comprovado por teste** · `CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:N`

Em uma conta cuja ativação ficou pendente, o conhecimento da senha permitiu obter o segredo de configuração, concluir a vinculação e receber uma sessão (200). Quem controla o autenticador passa a gerar códigos para a conta. Recomenda-se vincular a configuração a uma transação de cadastro com prazo curto, exigir prova independente de titularidade na retomada e invalidar o segredo pendente ao reiniciar a vinculação. [Serviço de autenticação](../../api/src/services/auth.service.ts) · [Log de ativação pendente](../../evidencias/mfa-pendente.log)

### Perda do histórico de falhas por IP

**Alta · Comprovado por teste** · `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N`

Na série mista, a API aceitou processar 60 falhas sem emitir 429. O serviço limpa o histórico do IP ao validar a senha, comprometendo o limite agregado entre contas. A resposta de segundo fator também confirmou senhas válidas no ensaio de credenciais reutilizadas. Por inspeção, login e ativação mantêm contadores de senha separados. Recomenda-se preservar as falhas do IP até o término da janela e aplicar um orçamento comum à verificação da mesma credencial. [Contadores](../../api/src/services/auth-attempt.service.ts) · [Fluxo](../../api/src/services/auth.service.ts) · [Log de tentativas](../../evidencias/contorno-limite-ip.log) · [Log de credenciais](../../evidencias/credential-stuffing.log)

### Rotas auxiliares de hash expostas

**Alta · Comprovado por teste quanto ao acesso anônimo** · `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H`

As rotas auxiliares de geração e verificação de hash retornaram 200 sem sessão. O hash gerado nessa interface usou bcrypt com custo 4. O cadastro usa Argon2id. Por inspeção, a verificação pública aceita um hash fornecido pelo cliente, o que expõe recursos de processamento a trabalho sem limite específico por rota. O impacto de indisponibilidade considerado no vetor não foi medido. Recomenda-se remover as rotas auxiliares da API publicada. [Registro das rotas](../../api/src/app.ts) · [Implementação](../../api/src/routes/password.routes.ts) · [Log de acesso](../../evidencias/rotas-auxiliares.log)

### Reutilização de código TOTP

**Média · Comprovado por teste** · `CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:H/I:H/A:N`

O mesmo código recebeu 200 em duas autenticações com a senha correta dentro de sua validade. O verificador compara o valor com os intervalos aceitos e não registra o intervalo consumido. Uma senha conhecida e um código já utilizado ainda válido podem autorizar outra sessão. Recomenda-se registrar por conta o intervalo aceito e impedir seu segundo consumo por meio de atualização atômica. [Verificador TOTP](../../api/src/services/totp.service.ts) · [Log de reutilização](../../evidencias/replay-totp.log)

### Segredo do autenticador legível no SQLite

**Média · Comprovado por teste para o segredo ativo** · `CVSS:3.1/AV:L/AC:L/PR:H/UI:N/S:U/C:H/I:H/A:N`

A leitura do registro de teste encontrou o segredo ativo em Base32, com 32 caracteres. Por inspeção, o segredo pendente também é gravado diretamente. A exposição de uma cópia do banco comprometeria a independência do segundo fator, pois permitiria reproduzir os códigos fora do dispositivo cadastrado. Recomenda-se criptografar os segredos ativos e pendentes com criptografia autenticada e manter a chave fora do banco e de seus backups. [Repositório de usuários](../../api/src/repositories/user.repository.ts) · [Log de armazenamento](../../evidencias/armazenamento.log)

### Enumeração de identidades

**Média · Comprovado por teste para o e-mail** · `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N`

O cadastro com e-mail já usado retornou 409. No login com senha incorreta, em 8 medições por condição, o teste registrou medianas de 65,4 ms para e-mail existente e 0,4 ms para inexistente. A consulta sem usuário pula a verificação do hash. A diferença pode revelar a presença de um cadastro. A análise do código também identificou que a duplicidade de RA também produz conflito, e a gravação de CPF informa ao usuário autenticado quando o documento já pertence a outra conta. Recomenda-se uniformizar o custo da verificação de senha em caso de usuário inexistente, reduzir a informação de duplicidade nas respostas e limitar as tentativas de cadastro e de gravação de documento. [Autenticação](../../api/src/services/auth.service.ts) · [Perfil](../../api/src/services/profile.service.ts) · [Medições locais](../../evidencias/enumeracao.log)

### Validação de origem nos fluxos de entrada

**Média · Identificado por inspeção** · `CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:L/A:L`

Cadastro, login e ativação do TOTP carecem da verificação explícita de origem aplicada às gravações do perfil. Em um navegador que permita o envio e aceite a resposta correspondente, uma requisição induzida por outro site pode alterar o contexto de autenticação da vítima. A suíte comprovou a rejeição de origem indevida no logout. A viabilidade desse cenário nos fluxos de entrada requer validação em navegador. Recomenda-se aplicar a política de origem às operações web que alteram estado e restringir os tipos de conteúdo ao formato previsto por rota. [Rotas](../../api/src/routes/auth.routes.ts) · [Configuração de CORS](../../api/src/app.ts) · [Ensaio específico do logout](../../evidencias/fixacao-csrf.log)

### Disponibilidade do login e bloqueio da conta

**Média · Identificado por inspeção quanto ao risco de indisponibilidade** · `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L`

O cadastro impõe um comprimento máximo à senha. O login e a ativação recebem o texto da credencial sem aplicar esse limite de campo antes da verificação; o único teto é o limite global de 2,2 MB do corpo da requisição. Também há risco de negar temporariamente o acesso legítimo de uma conta por falhas de terceiros. O log comprova que a senha correta recebeu 429 durante o bloqueio. O laboratório não mediu saturação de recursos nem bloqueio prolongado. Recomenda-se limitar a entrada antes do hash e aplicar atrasos progressivos com um meio de recuperação que confirme a titularidade. [Validação de credenciais](../../api/src/validators/auth.validators.ts) · [Controle de tentativas](../../api/src/services/auth-attempt.service.ts) · [Log de bloqueio](../../evidencias/forca-bruta.log)

### Transporte do cookie e cache de dados sensíveis

**Média · Identificado por inspeção para o cenário de implantação** · `CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:N/A:N`

A flag Secure depende de `NODE_ENV=production`. Uma implantação acessível por HTTP e configurada fora desse modo pode expor o cookie em trânsito. O log comprova a emissão local do cookie sem Secure. Por inspeção, apenas `GET /auth/avatar` envia `Cache-Control: private, no-store`; as respostas com dados de perfil ou de configuração do autenticador não têm essa política. Recomenda-se exigir HTTPS e Secure na implantação, verificar HSTS na terminação TLS e aplicar a política de cache às respostas sensíveis. [Configuração](../../api/src/config.ts) · [Rotas](../../api/src/routes/auth.routes.ts) · [Cookie observado](../../evidencias/cookie-atributos.log)

### Sessão sem rotação periódica e sem prazo de inatividade

**Baixa · Identificado por inspeção** · `CVSS:3.1/AV:N/AC:H/PR:L/UI:R/S:U/C:L/I:L/A:N`

O serviço verifica o prazo absoluto de 8 h. A sessão não registra a última atividade nem troca o token periodicamente. Uma cópia pode conservar o acesso até a expiração ou a revogação da sessão apresentada. O teste comprovou que o replay imediato recebeu 200 e que a cópia perdeu acesso após a revogação. Recomenda-se adotar prazo de inatividade, renovar o token em sessões prolongadas e permitir a revogação de todas as sessões da conta. [Serviço](../../api/src/services/session.service.ts) · [Esquema](../../api/src/database/schema.ts) · [Log de replay e revogação](../../evidencias/sequestro-sessao.log)

### Exposição potencial de detalhes internos e metadados de imagem

**Baixa · Identificado por inspeção** · `CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:N/A:N`

O tratador personaliza apenas erros da classe `HttpError`. O conteúdo da resposta a falhas inesperadas fica a cargo do framework. O avatar é armazenado com os bytes recebidos após validação do tipo e da assinatura, o que pode preservar metadados da imagem. Recomenda-se padronizar a resposta pública a erros inesperados e recodificar imagens para remover metadados. A suíte não registrou divulgação de detalhes nem exposição de metadados. Como observação de integridade à parte, o esquema declara exclusão em cascata de sessões, mas a inicialização não confirma a ativação de chaves estrangeiras. Convém verificar a configuração efetiva da conexão antes de depender da cascata. [Tratador](../../api/src/plugins/error-handler.ts) · [Avatar](../../api/src/routes/auth.routes.ts) · [Conexão](../../api/src/database/connection.ts) · [Esquema](../../api/src/database/schema.ts)

## Trade-offs de usabilidade e segurança

| Decisão | Benefício | Custo para o usuário e implicação de segurança |
| --- | --- | --- |
| Composição da senha | Rejeita entradas curtas e sem as classes exigidas. | Dificulta algumas frases-senha e aceita padrões previsíveis. Uma lista de senhas comuns ou comprometidas atuaria sobre a lacuna observada. |
| Bloqueio temporário | Contém séries de falhas por conta ou origem. | Um terceiro pode provocar negação de serviço (DoS) à conta. O usuário legítimo também precisa aguardar, mesmo com a credencial correta. |
| CAPTCHA ausente | O fluxo atual dispensa um desafio visual ou cognitivo e a integração de outro serviço. | Essa escolha reduz o atrito e favorece a acessibilidade, mas deixa descoberto um item do enunciado. Um desafio adaptativo com alternativa acessível teria menor custo de uso do que sua imposição em todo login. |
| TOTP e recuperação | A senha reutilizada sozinha não abriu sessão nas contas já ativadas. | O acesso depende do autenticador. O projeto não oferece códigos de recuperação. A perda do dispositivo exige um processo de recuperação que preserve a prova de titularidade. |
| Sessão de 8 h sem rotação periódica | Reduz interrupções por nova autenticação durante o uso. | Um cookie copiado pode continuar válido mesmo sem atividade da conta. Uma expiração por inatividade reduz esse intervalo, ao custo de novo login após uma pausa. |

## Limitações do trabalho

- A suíte usou HTTP em localhost, um único IP de origem e clientes programáticos. A avaliação não abrangeu HTTPS, terminação TLS, proxies, ataques distribuídos nem políticas de cookies de navegadores reais.
- A emissão local ocorreu sem Secure. A condição de produção foi identificada no código. As medianas de tempo descrevem a execução local, sem a variabilidade de uma rede externa.
- O banco era temporário. O ensaio de expiração alterou o prazo no banco e o de replay entregou uma cópia do cookie ao cliente de teste. Não houve observação da passagem integral das 8 h nem de furto de cookie em trânsito.
- A referência foi construída para a comparação. Fixação, origem do logout e expiração não tiveram medição equivalente nela. Possíveis impactos de carga, comportamentos de navegador e exposição de backups foram avaliados por inspeção.

## Conclusão

Para contas com TOTP ativo, a reutilização da senha deixou de produzir sessões no ensaio. O logout também passou a invalidar no servidor uma cópia do cookie, efeito que faltava à referência. As prioridades de correção são proteger a vinculação inicial do autenticador, conservar o histórico de falhas do IP e retirar as rotas públicas auxiliares de hash. O primeiro ajuste protege a conta antes que o TOTP esteja ativo. O segundo preserva o bloqueio entre contas. O terceiro elimina uma operação pública de processamento desnecessária ao login. Entre os requisitos do Projeto 3 ainda pendentes estão o CAPTCHA e a renovação da sessão durante o uso.

## Referências

- OWASP. Requisitos de autenticação e gestão de sessões. [Application Security Verification Standard 4.0.3](https://github.com/OWASP/ASVS/releases/tag/v4.0.3_release)
- OWASP. Metodologia para testes de aplicações web. [Web Security Testing Guide](https://wstg.owasp.org/v4.2/)
- NIST. Diretrizes de autenticação e gestão de autenticadores. [SP 800-63B-4 — Authentication and Authenticator Management](https://pages.nist.gov/800-63-4/sp800-63b.html)
- IETF. Algoritmo de senha de uso único baseado em tempo. [RFC 6238 — TOTP](https://www.rfc-editor.org/rfc/rfc6238)
- IRTF. Função de derivação Argon2. [RFC 9106 — Argon2](https://www.rfc-editor.org/rfc/rfc9106)
- OWASP. Orientações para armazenamento de senhas. [Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- OWASP. Orientações para o ciclo de vida das sessões. [Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- FIRST. Métricas de severidade e vetores-base. [CVSS v3.1 Specification](https://www.first.org/cvss/v3.1/specification-document)
- Projeto 3. Código-fonte da aplicação e artefatos locais da avaliação. [Repositório de autenticação](https://github.com/Matheus336/autenticacao) · [Evidências da entrega](../../evidencias/README.md)
