# GetLicence — stack 100% local (Supabase self-hosted)

Esta pasta roda **localmente no Ubuntu** o mesmo backend que o Lovable Cloud usa
(Postgres + GoTrue + PostgREST), em containers Docker. Assim, o **app React
do Lovable** (este repositório) roda sem nenhuma alteração, apontando para
o Supabase local em vez do Cloud.

> Resultado: paridade total de UI e features, sem reimplementação.

## Pré-requisitos
- Ubuntu 22.04 ou 24.04 (servidor ou VM).
- Acesso `sudo`.

## Instalação (uma linha)

```bash
git clone https://github.com/danielnwmt/getlicence.git /opt/getlicence
sudo bash /opt/getlicence/local/install.sh
```

O instalador:
1. instala Docker Engine + plugin `compose`;
2. cria `.env` com senhas e segredo JWT aleatórios;
3. pergunta email/senha do admin inicial e a URL pública;
4. gera as chaves `anon` e `service_role` a partir do `JWT_SECRET`;
5. sobe os containers (`db`, `auth`, `rest`, `proxy`);
6. cria o usuário admin via GoTrue e marca como `admin` em `user_roles`.

Ao final imprime os valores que você precisa colocar no `.env` do **frontend**.

## Como apontar o app do Lovable para o Supabase local

No repositório raiz, edite `.env` (ou crie `.env.local`):

```
VITE_SUPABASE_URL=http://SEU-IP:8000
VITE_SUPABASE_PUBLISHABLE_KEY=<SUPABASE_ANON_KEY do install>
VITE_SUPABASE_PROJECT_ID=local
SUPABASE_URL=http://SEU-IP:8000
SUPABASE_PUBLISHABLE_KEY=<SUPABASE_ANON_KEY do install>
SUPABASE_SERVICE_ROLE_KEY=<SUPABASE_SERVICE_ROLE_KEY do install>
```

Depois rode o app normalmente (`npm install && npm run dev`, ou build para
produção). Como o cliente `@supabase/supabase-js` só usa essas variáveis, **nenhum
código React precisa mudar** — toda a UI do Lovable (admin, dashboard, conta)
funciona como hoje.

## Operação

| Ação | Comando |
| --- | --- |
| Ver status | `cd /opt/getlicence/local && docker compose ps` |
| Logs | `docker compose logs -f auth rest db` |
| Parar | `docker compose down` |
| Subir | `docker compose up -d` |
| Atualizar imagens | `docker compose pull && docker compose up -d` |
| Backup do banco | `docker compose exec db pg_dumpall -U postgres > backup-$(date +%F).sql` |
| Reset total | `docker compose down -v` (apaga o banco!) |

## Estrutura
```
local/
  docker-compose.yml        # Postgres + GoTrue + PostgREST + Nginx
  proxy/nginx.conf          # gateway: /auth/v1 → GoTrue, /rest/v1 → PostgREST
  db/init/01_roles_and_auth.sql   # roles anon/authenticated/service_role + schema auth
  db/init/02_app_schema.sql       # tabelas do app, RLS, triggers handle_new_user
  gen-keys.sh               # gera SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
  install.sh                # bootstrap Ubuntu
  .env.example
```

