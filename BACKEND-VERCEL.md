# Backend de notificações (Vercel)

A Vercel hospeda **só** esta pasta `api/` (push + cron de lembretes). O app não roda aqui.

- **Subir/restaurar** (da raiz do projeto): `npm run deploy:backend`
- O `vercel.json` tem `ignoreCommand: "exit 0"`: push no Git **não** gera deploy. O backend só muda quando alguém roda o comando acima.
- O `.vercelignore` envia só `api/` + arquivos mínimos (nunca `google-services.json`, `src/`, etc.).
- **Não apague o deploy de produção** no painel: as notificações saem do ar até subir de novo.
- Quem trabalhar em outra branch deve mesclar a `Henrique` para ter o `vercel.json` e o `.vercelignore`.
