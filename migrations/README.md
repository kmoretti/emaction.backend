# 手动迁移

当前只有 `001_create_reactions`，应用启动不会自动执行 migration。

- MySQL：`npm run migrate:mysql`
- SQLite：`npm run migrate:sqlite`

migration SQL 是数据库结构的唯一事实来源；新增结构变更时新增版本化 migration，并先评估向后兼容。应用启动不会自动执行 migration。
