# 数据库初始化与切换

## MySQL 8+

1Panel 中用管理员账号创建数据库和专用应用账号：

```sql
CREATE DATABASE IF NOT EXISTS emaction
  CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
CREATE USER IF NOT EXISTS 'emaction_app'@'%' IDENTIFIED BY '<strong-password>';
GRANT SELECT, INSERT, UPDATE ON emaction.* TO 'emaction_app'@'%';
FLUSH PRIVILEGES;
```

首次执行 migration 时使用管理员账号，或单独创建仅用于 migration 的账号并在完成后收紧权限；运行中的 API 只使用 `emaction_app`，不使用 root。

应用通过 `MYSQL_HOST` 和 `MYSQL_PORT` 连接，不把地址写死。优先使用和 API 共享的私有 Docker network；不能共享时使用服务器私有 IP，不使用容器内的 `localhost`。

初始化表结构（建议使用一次性的管理员/迁移账号，不让 API 账号拥有 DDL 权限）：

```bash
MIGRATION_MYSQL_HOST=... MIGRATION_MYSQL_PORT=3306 \
MIGRATION_MYSQL_DATABASE=emaction MIGRATION_MYSQL_USER=<migration-user> \
MIGRATION_MYSQL_PASSWORD=... npm run migrate:mysql
```

如果迁移账号环境变量未设置，脚本会回退使用 `MYSQL_*` 配置。迁移完成后，运行中的 API 只使用 `emaction_app`。

应用启动不会自动迁移。

## SQLite

```bash
DB_DRIVER=sqlite SQLITE_PATH=./data/emaction.sqlite npm run migrate:sqlite
```

`DB_DRIVER=sqlite` 或 `DB_DRIVER=auto` 启动前都要求 SQLite 文件已经执行过 migration；fallback 不会自动创建表。

生产 SQLite 文件必须位于持久化目录。只复制数据库文件前应停止服务或使用一致性备份方式，并按部署环境处理 WAL 文件。

## driver 规则

- `DB_DRIVER=mysql`：MySQL 不可用时不静默切换；适合正式生产默认值。
- `DB_DRIVER=sqlite`：明确使用 SQLite。
- `DB_DRIVER=auto`：仅启动阶段尝试 MySQL，失败后使用 SQLite；运行期间不动态切换。

fallback 期间产生的 SQLite 数据不会自动合并回 MySQL。切回 MySQL 前必须人工核对数据。

## 计数一致性

`(target_id, reaction_name)` 是唯一键。MySQL 和 SQLite adapter 都在数据库写入语句中完成增量和下限保护，避免应用层先 SELECT 再 UPDATE 导致并发丢失。
