# Docker 部署实施方案

## 范围

本项目从 Cloudflare Worker 迁移为 Node.js HTTP 服务，供 1Panel OpenResty 反向代理。只改后端，不修改 `emaction.frontend`。

正式域名为 `https://api-emaction.081531.xyz`。旧域名 `api.emaction.cool` 不在当前用户控制范围，本次不处理。

## API 兼容

保持：

```text
GET   /reactions?targetId=...
PATCH /reaction?targetId=...&reaction_name=...&diff=...
```

Query 参数、响应字段、匿名调用、CORS 和 OPTIONS 保持兼容。GET 成功的 `data.reactionsGot` 始终为数组，`count` 为数字。新增 `GET /health` 不影响前端。

前端默认 endpoint 仍为旧域名；本次不修改前端。要使用新部署，调用方需要显式配置新 endpoint。

## 运行

需要 Node.js 22.x（与 Docker 镜像保持一致）。

```bash
npm ci
MIGRATION_MYSQL_HOST=... MIGRATION_MYSQL_PORT=3306 \
MIGRATION_MYSQL_DATABASE=emaction MIGRATION_MYSQL_USER=<migration-user> \
MIGRATION_MYSQL_PASSWORD=... npm run migrate:mysql
npm start
```

应用启动不会自动修改数据库。使用 SQLite 或 `DB_DRIVER=auto` 前，必须先在持久化路径执行 `npm run migrate:sqlite`；fallback 不会自动创建表。

Docker 使用 `Dockerfile` 和 `compose.example.yml`。服务器目录约定：

```text
/opt/emaction-backend
├── compose.yml
├── .env
└── data/
```

应用映射为 `127.0.0.1:5666 -> container:8080`。MySQL 由 1Panel 单独管理，不放入本项目 Compose。

## GHCR 发布

镜像为 `ghcr.io/kmoretti/emaction-backend`，GitHub Actions 构建 `linux/amd64`。推送 `v*` tag 会构建并推送镜像；只有仓库变量 `ENABLE_SSH_DEPLOY=true` 时才会 SSH 到服务器。`workflow_dispatch` 支持手动选择不可变 tag，并分别通过 `build=true/false` 和 `deploy=true/false` 选择是否构建推送、是否部署。SSH secrets 只在 GitHub Settings 中配置。生产 compose 必须显式设置不可变的 `IMAGE_TAG`，不能依赖 `latest`。

## 发布验收

```bash
curl -i https://api-emaction.081531.xyz/health
curl -i 'https://api-emaction.081531.xyz/reactions?targetId=deployment-check'
curl -i -X PATCH 'https://api-emaction.081531.xyz/reaction?targetId=deployment-check&reaction_name=thumbs-up&diff=1'
curl -i -X OPTIONS 'https://api-emaction.081531.xyz/reaction' \
  -H 'Origin: https://your-frontend.example' \
  -H 'Access-Control-Request-Method: PATCH'
```

## 回滚

生产固定不可变 tag。记录当前 tag/digest，出现问题时在 `/opt/emaction-backend` 更新 `IMAGE_TAG` 为上一版本并执行：

```bash
docker compose pull api
docker compose up -d api
```

数据库 schema 变更必须先确认向后兼容，不能把应用镜像回滚当成数据库回滚。
