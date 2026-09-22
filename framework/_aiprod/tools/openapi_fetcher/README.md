# openapi_fetcher

从 HTTP(S) 地址获取 OpenAPI 3.x JSON，校验结构，生成原始快照、来源元数据和原始文档变化报告。工具不修正文档，不读取需求，也不生成维护版接口目录。

```powershell
node .\_aiprod\runtime\aiprod-launcher.cjs run openapi_fetcher --config resources/api_contracts/api-contracts.json --service {service_id} --project-root .
```

也可不用配置文件，显式传入 `--url`、`--service`、`--environment`、`--raw`、`--metadata` 和 `--changes`。可用 `--timeout-ms` 覆盖超时，用 `--dry-run` 获取和校验但不写文件。`--catalog` 仅兼容需要额外保存原始接口目录的旧调用；正式 `operations.json` 由 `openapi_document_builder` 从维护版契约生成。

配置仅支持 JSON；字符串中的 `${local:NAME}`、`${secret:NAME}`、`${env:NAME}` 和 `${project_root}` 会被解析。OpenAPI 地址属于本机普通配置，通常直接写入 `secrets.local.json` 的 `locals`；认证值写入 `secrets`。工具也兼容单服务配置文件。不要在命令参数或可提交配置中写入真实令牌。输出路径必须位于项目根目录内。

成功输出包含 `document_changed`、接口数量、变化数量、文件位置和哈希元数据，供 Agent 决定后续目标，无需读取生成文件全文；失败返回非零退出码和结构化错误。
