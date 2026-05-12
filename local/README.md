# GetLicence — instalação local no Ubuntu (sem Docker)

Instalação bare-metal: PostgreSQL, PostgREST, GoTrue e Nginx instalados nativamente como serviços `systemd`. Cada servidor fica 100% independente.

## Requisitos

- Ubuntu 22.04+ ou 24.04+
- Acesso root (`sudo`)
- Domínio apontado para o servidor (opcional, para SSL automático)

## Instalar

```bash
git clone https://github.com/danielnwmt/GetLicence.git /opt/getlicence && \
sudo bash /opt/getlicence/local/install.sh
```

Com domínio + SSL (Let's Encrypt):

```bash
sudo APP_DOMAIN=app.exemplo.com bash /opt/getlicence/local/install.sh
```

O instalador automaticamente:

1. Instala Node.js 20, bun, PostgreSQL 16 e Nginx
2. Cria o banco, carrega o schema e os triggers
3. Baixa e configura **PostgREST** (API REST) como serviço
4. Baixa e configura **GoTrue** (autenticação) como serviço
5. Gera segredos JWT, `anon_key` e `service_role_key`
6. Compila o frontend (TanStack) e sobe como serviço
7. Configura Nginx como gateway (`/auth/v1`, `/rest/v1`, `/`)
8. Cria o admin inicial (`admin@getlicence.com` / `admin1234`)
9. Emite SSL com certbot se `APP_DOMAIN` estiver definido
10. Grava `/root/getlicence-credenciais.txt`

## Acesso

- Sem domínio: `http://SEU-IP`
- Com domínio: `https://seu-dominio.com`

## Operação

| Comando | Descrição |
| --- | --- |
| `sudo bash /opt/getlicence/update.sh` | Recompilar e reiniciar o app |
| `sudo bash /opt/getlicence/backup.sh` | Backup SQL em `/root/` |
| `sudo bash /opt/getlicence/uninstall.sh` | Remover instalação completa |
| `systemctl status getlicence-app` | Status do frontend |
| `systemctl status getlicence-auth` | Status do GoTrue |
| `systemctl status getlicence-postgrest` | Status do PostgREST |
| `journalctl -u getlicence-app -f` | Logs em tempo real |

## Estrutura

```
local/
  install.sh              # instalador único
  db/init/                # schema SQL (roles, auth, app)
```
