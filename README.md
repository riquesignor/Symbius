# Symbius

Trabalho de Conclusão de Curso (TCC) — um app social/acadêmico mobile feito em React Native (Expo) com backend serverless na Vercel e Firebase como banco de dados e autenticação.

A proposta é um ambiente único pra vida escolar/acadêmica: feed de resumos entre colegas, chat privado, calendário de provas e eventos, sistema de gamificação (XP, níveis, leaderboard) e um painel administrativo.

## Funcionalidades

- **Autenticação e perfil** — cadastro, login, perfil público e configurações de conta.
- **Feed de resumos** — colegas publicam e consomem resumos de matérias.
- **Chat** — conversas privadas em tempo real (via WebSocket).
- **Calendário** — provas, feriados e avisos cadastrados pelo admin, mais lembretes pessoais.
- **Match** — sistema de pareamento entre usuários.
- **Gamificação** — XP, níveis e ranking (leaderboard) pra engajar o uso do app.
- **Loja** — resgate de itens/benefícios com os pontos acumulados.
- **Notificações push** — avisos de eventos, lembretes e mensagens via Firebase Cloud Messaging.
- **Painel admin** — gestão de eventos, provas, feriados e avisos exibidos no app.

## Stack

- **App:** React Native + Expo (SDK 57), React Navigation, TypeScript
- **Backend:** Vercel Serverless Functions (`api/`) com Firebase Admin SDK, agendadas via cron da Vercel
- **Chat em tempo real:** servidor WebSocket próprio (`server.js`)
- **Dados/Auth:** Firebase (Firestore + Authentication + Cloud Messaging)

## Rodando o projeto

### Pré-requisitos

- Node.js 20+ (alguns pacotes do backend pedem Node 22, veja aviso abaixo)
- Conta e projeto no [Firebase](https://console.firebase.google.com/) (Firestore, Authentication e Cloud Messaging habilitados)
- [Expo Go](https://expo.dev/go) ou um build de dev client, pra rodar no celular/emulador

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

Copie `.env.example` para `.env` e preencha com as credenciais do **seu** projeto Firebase (Console → Configurações do projeto):

```bash
cp .env.example .env
```

- As variáveis `EXPO_PUBLIC_FIREBASE_*` vêm de **Configurações do projeto → Seus apps → app Web → Configuração do SDK**. Esses valores não são secretos — o próprio Firebase foi desenhado pra eles irem embutidos no app; a proteção real dos dados é feita pelas regras do Firestore.
- As variáveis `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` são da **service account** (Configurações do projeto → Contas de serviço → Gerar nova chave privada) e **são secretas** — usadas só pelo backend (`api/`) pra enviar push notifications. Nunca commite o `.env` nem o `.json` baixado do Firebase.
- `CRON_SECRET` é um valor aleatório gerado por você (ex: `openssl rand -hex 32`), usado pra proteger a rota de cron contra chamadas não autorizadas.

### 3. Build Android (opcional)

Pra builds nativas Android, baixe o `google-services.json` do seu projeto Firebase (Console → Configurações do projeto → Seus apps → app Android) e coloque na raiz do projeto — use `google-services.json.example` como referência de formato. Esse arquivo não é versionado.

### 4. Rodar o app

```bash
npm start
```

Escaneie o QR code com o Expo Go, ou pressione `a` / `i` pra abrir no emulador Android/iOS.

### 5. Chat em tempo real (opcional, local)

```bash
node server.js
```

Sobe o servidor WebSocket em `ws://localhost:3001`.

### 6. Backend serverless (opcional, local)

As funções em `api/` rodam na Vercel. Pra testar localmente, use a [Vercel CLI](https://vercel.com/docs/cli):

```bash
vercel dev
```

## Estrutura

```
api/              Funções serverless (push notifications, cron de lembretes)
src/
  components/     Componentes reutilizáveis
  config/         Configuração do Firebase (client)
  constants/      Cores, tema e constantes do app
  contexts/       Providers de contexto (configurações, notificações)
  screens/        Telas do app
  services/       Regras de negócio e acesso a dados (auth, gamificação, resumos, push)
  utils/          Funções utilitárias
server.js         Servidor WebSocket do chat
```

## Autores

Projeto desenvolvido em dupla como Trabalho de Conclusão de Curso:

- [Henrique](https://github.com/riquesignor)
- [João](https://github.com/jpx-nextage)
