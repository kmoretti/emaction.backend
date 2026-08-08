# Docker / 1Panel 部署

## 部署目标

运行时使用 Node.js 22.x，服务器镜像目标为 `linux/amd64`。

正式 API 域名：`https://api-emaction.081531.xyz`。

当前文档只覆盖后端。前端仓库默认仍使用旧的 `https://api.emaction.cool`，本次不修改前端；使用新后端时，需要在前端组件显式设置 `endpoint`。

## 架构

```text
浏览器
  ↓ HTTPS
1Panel OpenResty（api-emaction.081531.xyz）
  ↓ 127.0.0.1:5666
Docker API（Node.js，容器 8080）
  ↓
1Panel MySQL（首选）或持久化 SQLite（显式 fallback）
```

API 容器只绑定宿主机回环地址，不直接暴露公网。MySQL 不放入本项目 Compose，由 1Panel 独立管理。

## GitHub Actions / GHCR

镜像：`ghcr.io/kmoretti/emaction-backend`。

- 服务器架构：`linux/amd64`。
- 推送 `v*` tag 自动构建并推送镜像；只有仓库变量 `ENABLE_SSH_DEPLOY=true` 时才会继续 SSH 部署。
- `workflow_dispatch` 可手动指定不可变 tag，并分别通过 `build=true/false` 和 `deploy=true/false` 控制构建推送与 SSH 部署。
- `ci.yml` 在 `main` push 和 Pull Request 上运行 lint 和测试。
- 生产使用不可变版本 tag，不依赖 `latest`。
- 开启 SSH 部署前，GitHub Secrets 需要配置：`DEPLOY_HOST`、`DEPLOY_USER`、`DEPLOY_SSH_KEY`、`GHCR_USERNAME`、`GHCR_TOKEN`，以及可选 `DEPLOY_PORT`；未开启部署时不需要这些服务器 Secrets。
- 服务器需要预先登录私有 GHCR，并在 `/opt/emaction-backend` 准备 `compose.yml`、`.env` 和 `data/`。

## 服务器准备

```bash
sudo mkdir -p /opt/emaction-backend/data
# bind mount 时，宿主机目录需要允许容器内 node 用户写入
sudo chown -R 1000:1000 /opt/emaction-backend/data
cd /opt/emaction-backend
# 将 compose.example.yml 复制为 compose.yml，并按服务器配置创建 .env
```

`.env` 示例：

```dotenv
NODE_ENV=production
HOST=0.0.0.0
PORT=8080
APP_VERSION=v1.0.0
IMAGE_TAG=v1.0.0
DB_DRIVER=mysql
MYSQL_HOST=<1Panel MySQL service name or private IP>
MYSQL_PORT=3306
MYSQL_DATABASE=emaction
MYSQL_USER=emaction_app
MYSQL_PASSWORD=<secret>
```

不要把真实 `.env` 提交到 Git。

## MySQL 初始化

在 1Panel MySQL 中用管理员账号执行一次：

```sql
CREATE DATABASE IF NOT EXISTS emaction
  CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
CREATE USER IF NOT EXISTS 'emaction_app'@'%' IDENTIFIED BY '<strong-password>';
GRANT SELECT, INSERT, UPDATE ON emaction.* TO 'emaction_app'@'%';
FLUSH PRIVILEGES;
```

然后执行 schema migration。migration 使用管理员账号或一次性的 migration 专用账号；API 运行时只使用上面的低权限 `emaction_app`。

如果直接在源码工作区执行：

```bash
npm ci
MIGRATION_MYSQL_HOST=... MIGRATION_MYSQL_DATABASE=emaction MIGRATION_MYSQL_USER=<migration-user> MIGRATION_MYSQL_PASSWORD=... npm run migrate:mysql
```

如果使用已经发布的 Docker 镜像执行：

```bash
IMAGE_TAG=v1.0.0 docker compose run --rm \
  -e MIGRATION_MYSQL_USER=<migration-user> \
  -e MIGRATION_MYSQL_PASSWORD=<migration-password> \
  api node scripts/migrate.js mysql
```

## SQLite 初始化与 fallback

SQLite 运行前必须先初始化持久化文件：

```bash
DB_DRIVER=sqlite SQLITE_PATH=./data/emaction.sqlite npm run migrate:sqlite
```

生产 SQLite 必须把 `./data` 持久化到宿主机。只有明确设置：

```dotenv
DB_DRIVER=auto
```

才会在启动阶段 MySQL 连接失败时使用 SQLite。运行期间不会动态切换数据库；fallback 不会自动创建表，切回 MySQL 前必须人工核对 fallback 期间产生的数据。

## 启动与验证

```bash
export IMAGE_TAG=v1.0.0
docker compose pull api
docker compose up -d api
docker compose ps
curl -i https://api-emaction.081531.xyz/health
curl -i 'https://api-emaction.081531.xyz/reactions?targetId=deployment-check'
curl -i -X PATCH 'https://api-emaction.081531.xyz/reaction?targetId=deployment-check&reaction_name=thumbs-up&diff=1'
```

`/health` 成功时返回当前数据库模式，例如：

```json
{"status":"ok","database":"mysql","mode":"primary","degraded":false,"version":"v1.0.0"}
```

SQLite fallback 时返回 HTTP 200，并带：

```json
{"database":"sqlite","mode":"fallback","degraded":true}
```

如果 `DB_DRIVER=mysql` 且数据库不可用，health 应返回 503 或服务无法正常启动。

## OpenResty 要点

在 1Panel OpenResty 中为 `api-emaction.081531.xyz` 配置 HTTPS，并反代到：

```text
http://127.0.0.1:5666
```

必须确保：

- 原样保留 `/reactions` 和 `/reaction` 路径，不添加 `/api` 前缀；
- 保留 Query String；
- 允许并转发 `PATCH`；
- `OPTIONS` 预检可以到达 API；
- 不删除 API 返回的 CORS headers；
- 不缓存 `/reactions` 和 `/reaction`；
- 转发 `Host`、`X-Forwarded-For`、`X-Forwarded-Proto`；
- HTTPS 不发生跨域重定向；
- `/health` 可以被监控访问。

## 备份与回滚

MySQL 由 1Panel 配置备份，至少验证一次恢复。SQLite 使用 `/opt/emaction-backend/data` 持久化；备份前应停止服务或使用一致性 SQLite 备份方式，并按部署环境处理 WAL 文件。

发布回滚：

```bash
cd /opt/emaction-backend
export IMAGE_TAG=v1.0.0
docker compose pull api
docker compose up -d api
```

回滚前记录当前 tag/digest。数据库 schema 变更必须先确认可向后兼容，再发布应用镜像。
