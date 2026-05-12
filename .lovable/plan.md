# Plano de correção total + versão self-hosted Ubuntu

O trabalho será dividido em **3 fases**. Cada fase é entregável sozinha — não precisa esperar tudo terminar para usar.

---

## Fase 1 — Corrigir bugs no sistema atual (Lovable Cloud)

Objetivo: deixar o sistema 100% funcional do jeito que está hoje, antes de mexer em arquitetura.

### 1.1 Listagem e cadastro de clientes
- Criar trigger `on_auth_user_created` em `auth.users` chamando `handle_new_user()` (a função existe, o trigger sumiu — por isso novos usuários não viram profile/role automaticamente).
- Revisar `createCustomer`: garantir CPF/CNPJ só com dígitos no banco, telefone normalizado, e rollback do auth user se profile/role falhar (já está parcialmente feito).
- Revisar `listAdminProfiles`: ocultar o próprio admin logado e qualquer usuário com role `admin` (você já pediu antes; confirmar que está aplicado).
- Mostrar mensagem de erro real no formulário em vez de silenciar.

### 1.2 Login / permissões
- Garantir que `useAuth` espera o role carregar antes de liberar rotas admin (hoje há janela onde `role` é null e o guard pode confundir).
- Adicionar guard explícito em `/_authenticated/admin` redirecionando cliente para `/dashboard`.
- Adicionar tela de "sem permissão" em vez de tela em branco.

### 1.3 Cadastro / conta (formulários)
- Validar CPF/CNPJ (não só formatar — verificar dígitos).
- Validar CEP antes de chamar ViaCEP, mostrar erro quando CEP não existe.
- Trim em todos os campos de texto antes de salvar.

### 1.4 Pequenas correções de UI
- Botões de Configurações → Usuários / Integrações: confirmar que abrem corretamente após a última reorganização.
- Loading states nos botões de salvar (evitar duplo clique).

---

## Fase 2 — Adaptar código para Postgres local (sem Supabase)

Objetivo: trocar Supabase por Postgres puro + camada própria de auth, mantendo o mesmo frontend.

### 2.1 Camada de banco
- Adicionar `drizzle-orm` + `postgres` (driver). Drizzle suporta Workers, Node e Bun.
- Recriar todas as tabelas como schema Drizzle a partir do SQL atual (`profiles`, `user_roles`, `products`, `licenses`, `payments`, `payment_settings`).
- Gerar migrations versionadas em `drizzle/migrations/` que rodam no startup do app.

### 2.2 Autenticação própria
- Substituir `supabase.auth` por auth próprio:
  - tabela `users` (email, password_hash com bcrypt, created_at).
  - JWT assinado com `JWT_SECRET` local (cookie httpOnly).
  - endpoints `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`, `/api/auth/signup` (signup pode ficar só admin).
- Reescrever `requireSupabaseAuth` middleware para validar JWT local.
- Substituir `supabase.from(...)` por queries Drizzle em todos os `*.functions.ts`.

### 2.3 RLS → checagens no servidor
- Remover RLS (Postgres local de instalação única não precisa).
- Toda checagem de "é admin?" vira `has_role(userId, 'admin')` no handler antes da query.
- `listAdminProfiles`, `createCustomer`, `createSystemUser`, etc. ganham guarda explícita.

### 2.4 Configuração por ambiente
- `.env.local` com: `DATABASE_URL`, `JWT_SECRET`, `PORT`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (cria admin no primeiro boot).
- Remover qualquer referência a `VITE_SUPABASE_*` em runtime.

---

## Fase 3 — Empacotar para instalar no Ubuntu

Objetivo: cliente roda 1 comando no Ubuntu e tem o sistema funcionando, com banco local próprio.

### 3.1 Build de produção em Node
- Trocar target de Cloudflare Workers para Node (Vite + `@tanstack/react-start` suporta Node adapter).
- `bun run build` gera `.output/` rodável com `node .output/server/index.mjs`.

### 3.2 Script de instalação
Arquivo `install.sh`:
```bash
# 1. Instala Node 20 e Postgres 16 via apt
# 2. Cria usuário/db locais (axis_user / axis_db) com senha aleatória
# 3. Escreve .env.local com a DATABASE_URL
# 4. Roda migrations
# 5. Cria primeiro admin (pergunta email/senha)
# 6. Instala como serviço systemd (axis-licencas.service)
# 7. Habilita inicialização no boot
```

### 3.3 Serviço systemd
- `/etc/systemd/system/axis-licencas.service` rodando o app em `127.0.0.1:3000`.
- Opcional: bloco de instruções nginx + certbot se cliente quiser expor publicamente.

### 3.4 Atualizações
- Script `update.sh` que faz `git pull` (ou baixa release tarball), `bun install`, `bun run build`, roda migrations novas e reinicia o serviço.

### 3.5 Backup
- Script `backup.sh` que faz `pg_dump` do banco local para `/var/backups/axis/<data>.sql.gz`.
- Linha de cron exemplo no install.

---

## Ordem de entrega sugerida

1. **Agora**: Fase 1 inteira (bugs). Você continua usando a versão Lovable Cloud normalmente.
2. **Depois**: Fase 2 numa branch separada — quando estiver pronta, a versão Cloud para de receber mudanças e o foco vira o pacote local.
3. **Por último**: Fase 3, gerando o primeiro `install.sh` testável numa VM Ubuntu.

---

## Pontos que preciso confirmar antes de começar

1. **Versão Cloud x Local convivem?** Você quer manter a versão atual na Lovable Cloud rodando (para você usar internamente) e o pacote local para clientes? Ou abandonar a Cloud assim que a local funcionar?
2. **Multi-tenant local?** Cada instalação atende **1 empresa só** (modelo mais simples), correto? Sem login multi-empresa.
3. **Login Google** no pacote local: mantém ou só email/senha? (Google exige OAuth configurado pelo cliente, complica instalação.)
4. **Pagamentos (Asaas/Sicredi/Sicoob)**: continuam na versão local? As chaves vão para `.env.local` de cada instalação?

Posso começar pela **Fase 1** já enquanto você responde essas 4 perguntas — os bugs não dependem da decisão de arquitetura.
