# API de autenticação acadêmica

## Executar

Requer Bun 1.3.14. Na pasta `api`, instale as versões registradas no lockfile:

```bash
bun install --frozen-lockfile
```

Inicie a API:

```bash
bun run dev
```

A API fica disponível em `http://localhost:3000`. Os cadastros são persistidos
em `api/data/users.sqlite`, criado automaticamente.

Em produção, defina `WEB_ORIGIN` com a origem exata do frontend e
`NODE_ENV=production` para habilitar cookies `Secure`. `DATA_DIRECTORY` pode
ser definido para escolher outro diretório para o banco.

## Fluxo de autenticação

- `POST /auth/register`: recebe `fullName`, `ra`, `email` e `password`.
  O RA e o e-mail devem ser únicos; a senha deve ter pelo menos 8 caracteres.
  A resposta inclui uma chave TOTP e uma URI `otpauth://` para configurar um
  aplicativo autenticador.
- `POST /auth/totp/activate`: recebe `email`, `password` e o código TOTP de
  seis dígitos para confirmar e ativar a autenticação multifator.
- `POST /auth/login`: recebe `email` e `password`. Se o TOTP estiver ativo,
  também exige `code`. Se ainda não estiver ativo, responde com os dados para
  configurá-lo e exige a confirmação do código antes de autenticar. Após o
  login completo, cria uma sessão com cookie `HttpOnly` de oito horas.
- `GET /auth/me`: retorna os dados do usuário e os horários de criação e
  expiração da sessão atual.
- `PUT /auth/me/document`: atualiza o CPF válido do usuário autenticado.
- `POST /auth/logout`: encerra a sessão atual.
- `POST /auth/avatar` e `GET /auth/avatar`: salvam e exibem uma foto JPEG, PNG
  ou WebP de até 2 MB, somente para a sessão autenticada.

O CPF não é solicitado durante o cadastro. Ele pode ser adicionado ou alterado
no painel após autenticação, e deve ser válido e único. A migração do banco
adiciona esse campo às contas existentes; para essas contas, o painel informa
que o CPF não foi cadastrado.

O TOTP usa códigos SHA-1 de seis dígitos, com intervalo de 30 segundos e
tolerância de um intervalo para diferença de relógio. Esta implementação é
adequada para desenvolvimento; para produção, configure HTTPS, proteção contra
tentativas repetidas e armazenamento protegido das chaves TOTP e do banco.

Os endpoints de login e ativação do TOTP limitam falhas de senha e de código:
após 5 falhas para uma conta ou 20 falhas pelo mesmo IP, novas tentativas dessa
etapa são bloqueadas por 15 minutos. Os contadores são persistidos no SQLite e
limpos após uma autenticação bem-sucedida na respectiva etapa. O endereço IP é
obtido diretamente da conexão do servidor, sem confiar em cabeçalhos de proxy.
