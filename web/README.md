# Frontend

Interface web do sistema de autenticação acadêmica, construída com React,
TypeScript e Vite. As chamadas de autenticação e perfil são feitas à API
descrita em [`../api/README.md`](../api/README.md).

## Telas

### Login

A tela de login aceita e-mail e senha. Quando a conta exige autenticação
multifator, solicita o código TOTP de seis dígitos. Se o usuário ainda não
ativou o TOTP, apresenta o QR code e a chave para configurar um aplicativo
autenticador e confirmar a configuração. Após autenticação completa, a API cria
uma sessão no cookie `HttpOnly` e o frontend abre o painel.

### Cadastro

O cadastro pede nome completo, RA, e-mail e senha. A senha deve ter ao menos
oito caracteres, uma letra maiúscula, uma letra minúscula e um número;
caracteres especiais são opcionais. O cadastro não solicita CPF. Depois de
criar a conta, o usuário pode ativar o TOTP ou deixar a ativação para o primeiro
login.

### Painel do usuário

O painel apresenta nome, RA, e-mail, CPF, foto de perfil e tempo desde a
autenticação. A foto pode ser JPEG, PNG ou WebP de até 2 MB. O CPF pode ser
adicionado ou alterado depois do login e precisa ser válido e único.

RA, e-mail e CPF aparecem ocultos inicialmente; o botão **Exibir dados** os
revela apenas na tela atual. Essa ocultação é uma proteção visual, não substitui
controle de acesso: os dados continuam sendo enviados pela API para o navegador.
O painel permite encerrar a sessão, que expira após oito horas.

## Requisitos

- [Bun](https://bun.sh/) 1.3.14.
- A API em execução, normalmente em `http://localhost:3000`.

## Instalação e execução

Na raiz `web/`, instale exatamente as dependências registradas no lockfile:

```sh
bun install --frozen-lockfile
```

Em um terminal, inicie a API na pasta `api/`:

```sh
bun run dev
```

Em outro terminal, inicie o frontend na pasta `web/`:

```sh
bun run dev
```

O Vite disponibiliza a interface em `http://localhost:5173`.

Para apontar para outra origem da API, crie `web/.env.local`:

```dotenv
VITE_API_URL=http://localhost:3000
```

O valor padrão de `VITE_API_URL` é `http://localhost:3000`. Em produção,
configure `WEB_ORIGIN` no backend com a origem exata deste frontend e use HTTPS
para que o cookie de sessão seja enviado com segurança.

## Verificações

```sh
bun run build
bun run lint
```

## Organização do código

- `src/pages/`: telas e composição de página, incluindo Login, Register e
  Dashboard.
- `src/components/`: partes de interface reutilizáveis ou específicas de uma
  área.
- `src/hooks/`: estado e lógica de interação das telas e componentes.
- `src/api/`: comunicação HTTP com a API.
- `src/schemas/`: validações de dados no frontend.
- `src/types/`: tipos compartilhados.
- `src/utils/`: funções utilitárias.

## Dependências

As versões diretas estão fixadas em `package.json` e as versões transitivas
estão registradas em `bun.lock`. Use Bun para instalar dependências e mantenha
ambos os arquivos no controle de versão.
