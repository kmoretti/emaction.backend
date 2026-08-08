# 前端 API 兼容清单

基于 `emaction.frontend` 提交 `ee0b4f6d8239a10bd937ff3b30dcfae34cbaa7dd` 的只读审查。

## 必须保持

- `GET /reactions`
- `PATCH /reaction`
- Query 参数名：`targetId`、`reaction_name`、`diff`
- 不要求 request body
- `diff=1` 增加，`diff=-1` 减少
- count 不小于 0
- GET 成功返回 `data.reactionsGot` 数组
- 数组元素的 `reaction_name` 和数字类型 `count`
- PATCH 返回 `code` 和 `msg`
- 匿名调用，不强制认证
- CORS 与 PATCH OPTIONS 预检

前端默认 endpoint 是 `https://api.emaction.cool`，新后端域名是 `https://api-emaction.081531.xyz`。本次不修改前端，使用新域名必须由调用方显式设置 endpoint。

前端默认 target ID 是 canonical URL 去除 hash 后的 SHA-256 小写十六进制字符串。后端必须把 `targetId` 当作不透明字符串处理。

## 实现差异

后端会拒绝 `diff=0`，避免现有 Worker 将无效零值误解释为减一。已发布前端只发送 `1` 或 `-1`，因此不影响正常调用。
