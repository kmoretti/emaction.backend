# OpenResty 反向代理要点

正式域名：`api-emaction.081531.xyz`。

1Panel OpenResty 应为该域名配置 HTTPS，反向代理到 API 容器映射的：

```text
http://127.0.0.1:18080
```

必须保持：

- `/reactions`、`/reaction`、`/health` 路径不变；
- Query String 原样转发；
- 允许 `GET`、`PATCH`、`OPTIONS`；
- 不把 `/reaction` 改写成 `/api/reaction`；
- 不删除应用返回的 `Access-Control-*` 响应头；
- 不缓存 `/reactions` 和 `/reaction`；
- 设置 `Host`、`X-Real-IP`、`X-Forwarded-For`、`X-Forwarded-Proto`；
- 不对 API 域名做会改变跨域语义的重定向。

当前前端仓库默认使用 `https://api.emaction.cool`，本次后端任务不修改前端；只有显式配置 `endpoint="https://api-emaction.081531.xyz"` 的前端实例会请求新域名。
