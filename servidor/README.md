# GetLicence — Pacote self-hosted (Ubuntu)

Versão standalone do sistema rodando **100% local** em Postgres, sem depender da Lovable Cloud / Supabase.

## Requisitos

- Ubuntu 22.04 ou 24.04 (servidor com acesso root)
- 1 GB de RAM, 10 GB de disco (mínimo)
- Porta 3000 disponível (ou ajustável no `.env`)

## Instalação em 1 comando (recomendado — direto do GitHub)

No servidor Ubuntu, como root:

```bash
curl -fsSL https://raw.githubusercontent.com/danielnwmt/getlicence/main/servidor/setup-from-github.sh | sudo bash
```

O script clona o repositório em `/opt/getlicence-src`, executa o `install.sh` oficial e deixa o sistema rodando.

## Instalação manual (sem GitHub)

```bash
# 1. Copie a pasta servidor/ para o servidor
scp -r servidor ubuntu@SEU-SERVIDOR:/tmp/

# 2. No servidor, execute o instalador
ssh ubuntu@SEU-SERVIDOR
cd /tmp/servidor
sudo bash install.sh
```

O instalador faz tudo:
1. Instala Node.js 20 e PostgreSQL.
2. Cria o banco `getlicence_db` e o usuário `getlicence_user` com senha aleatória.
3. Copia o app para `/opt/getlicence`.
4. Pergunta o **email e senha do admin inicial**.
5. Gera `.env` com `JWT_SECRET` aleatório e `DATABASE_URL` local.
6. Aplica o `schema.sql`.
7. Instala o serviço `getlicence.service` no systemd e inicia.

Ao final, o sistema responde em `http://IP-DO-SERVIDOR:3000`.

## Comandos úteis

```bash
sudo systemctl status getlicence      # status
sudo systemctl restart getlicence     # reiniciar
sudo journalctl -u getlicence -f      # logs ao vivo
curl http://127.0.0.1:3000/api/health    # checar saúde + banco
```

## Atualizar

```bash
# Coloque a nova pasta servidor/ no servidor e:
sudo bash update.sh
```
O `.env` e o banco são **preservados**.

## Backup automático

```bash
sudo cp /opt/getlicence/backup.sh /etc/cron.daily/axis-backup
sudo chmod +x /etc/cron.daily/axis-backup
```
Backups em `/var/backups/axis/`, retenção de 30 dias.

## Pagamentos (opcional)

Edite `/opt/getlicence/.env` e preencha somente o provedor que for usar:
- `ASAAS_API_KEY`, `ASAAS_ENV`
- `SICREDI_CLIENT_ID`, `SICREDI_CLIENT_SECRET`, `SICREDI_CERT_PEM`, `SICREDI_CERT_KEY`
- `SICOOB_CLIENT_ID`, `SICOOB_ACCESS_TOKEN`, `SICOOB_CERT_PEM`, `SICOOB_CERT_KEY`

Depois: `sudo systemctl restart getlicence`.

## Endpoints da API

Autenticação por cookie (`axis_session`) ou header `Authorization: Bearer <token>`.

| Método | Caminho | Permissão | Descrição |
|---|---|---|---|
| POST | `/api/auth/login` | público | login com email/senha |
| POST | `/api/auth/logout` | qualquer | encerra sessão |
| GET  | `/api/auth/me` | autenticado | perfil + role |
| POST | `/api/auth/change-password` | autenticado | troca senha |
| GET  | `/api/profile` | autenticado | meu perfil |
| PUT  | `/api/profile` | autenticado | atualiza perfil |
| GET  | `/api/customers` | admin | lista clientes |
| POST | `/api/customers` | admin | cadastra cliente |
| DELETE | `/api/customers/:userId` | admin | remove cliente |
| GET  | `/api/products` | autenticado | lista produtos |
| POST/PUT/DELETE | `/api/products[/:id]` | admin | CRUD produtos |
| GET  | `/api/licenses` | autenticado | minhas/todas licenças |
| POST/PUT/DELETE | `/api/licenses[/:id]` | admin | CRUD licenças |
| GET  | `/api/payments` | autenticado | meus/todos pagamentos |
| POST | `/api/payments` | admin | cria pagamento |
| PUT  | `/api/payments/:id/mark-paid` | admin | marca como pago |
| GET/PUT | `/api/payment-settings` | admin | provedor ativo |

## Frontend

O frontend (React + Vite + Tailwind) fica em `servidor/web-src/` e é **compilado automaticamente pelo `install.sh`** para `servidor/web/`, que o Express serve na mesma porta 3000.

Páginas incluídas:
- `/login` — login email + senha
- `/admin` — abas: Clientes, Produtos, Licenças, Pagamentos, Config pagamentos
- `/dashboard` — minhas licenças e pagamentos (cliente)
- `/account` — atualizar perfil e trocar senha

Para desenvolver localmente: `cd servidor/web-src && npm install && npm run dev` (proxy do `/api` aponta para o backend em `127.0.0.1:3000`).

## Estrutura

```
servidor/
├── install.sh            # instalação completa Ubuntu
├── update.sh             # atualização preservando dados
├── backup.sh             # pg_dump diário
├── getlicence.service # unidade systemd
├── schema.sql            # schema Postgres completo
├── .env.example
├── package.json
├── tsconfig.json
└── src/
    ├── server.ts         # bootstrap Express
    ├── db.ts             # pool pg
    ├── auth.ts           # bcrypt + JWT
    ├── middleware.ts     # requireAuth / requireAdmin
    ├── migrate.ts
    ├── seed-admin.ts
│   ├── lib/cpf-cnpj.ts
│   └── routes/
│       ├── auth.ts
│       ├── profile.ts
│       ├── customers.ts
│       ├── products.ts
│       ├── licenses.ts
│       ├── payments.ts
│       └── payment-settings.ts
└── web-src/              # frontend React (Vite + Tailwind)
    ├── package.json
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── api.ts        # cliente fetch para /api/*
        ├── auth.tsx      # provider de sessão
        ├── ui.tsx        # componentes (botão, input, modal, badge…)
        └── pages/
            ├── Login.tsx
            ├── Admin.tsx
            ├── Dashboard.tsx
            └── Account.tsx
```
