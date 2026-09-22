# api_contract_registry

依据维护版接口目录维护逐接口或分发变体的稳定 `operation_id`、契约验证状态、验证等级和具名请求格式，并同步生成 Markdown 索引。`registry.json` 和 `index.md` 必须由本工具写入，不得手工编辑。`operation_id` 统一按规范接口键生成 `op_{base64url(key)}`，不使用上游 OpenAPI 的 `operationId`；API 维护流程独立产出，下游只消费。

首次或每次获取后同步：

```powershell
node .\_aiprod\runtime\aiprod-launcher.cjs run api_contract_registry sync --catalog resources/api_contracts/{service_id}/operations.json --registry resources/api_contracts/{service_id}/registry.json --index resources/api_contracts/{service_id}/index.md --project-root .
```

校准后更新一个或多个接口：

```powershell
node .\_aiprod\runtime\aiprod-launcher.cjs run api_contract_registry set --catalog resources/api_contracts/{service_id}/operations.json --registry resources/api_contracts/{service_id}/registry.json --index resources/api_contracts/{service_id}/index.md --operation "POST /api/orders" --status verified --evidence "src/.../OrderController.java" --note "路由、请求模型和响应包装一致" --project-root .
```

`--operation` 和 `--evidence` 可重复。`--status` 允许 `pending`、`verified`、`blocked`、`conflict`；`--level` 允许 `L0`（仅发现）、`L1`（结构对齐）、`L2`（可调用格式已确定）、`L3`（真实运行已验证）；`--lifecycle` 允许 `active`、`deprecated`、`removed`。`blocked` 和 `conflict` 必须带 `--note`；`verified` 必须至少带一个 `--evidence`，且只对目录中的当前接口指纹有效。历史 `verified` 在缺少等级时按 L2 读取，执行一次 `sync` 会把 L2 持久化，无需重新验证。

非默认请求格式通过 profile 文件登记。文件必须包含 `verification_level`，可用 `serialization.query` 为字段指定 `indexed/repeat/comma/space/pipe/json`：

```json
{
  "verification_level": "L2",
  "serialization": { "query": { "workerList": "indexed", "endTime": "indexed" } },
  "evidence": ["前端请求序列化实现或接口说明"]
}
```

```powershell
node .\_aiprod\runtime\aiprod-launcher.cjs run api_contract_registry set `
  --catalog resources/api_contracts/{service_id}/operations.json `
  --registry resources/api_contracts/{service_id}/registry.json `
  --index resources/api_contracts/{service_id}/index.md `
  --operation "GET /api/work-records" --request-profile worker-and-time-filter `
  --profile-file work/artifacts/worker-and-time-filter.json --project-root .
```

测试执行器不写 registry。真实测试结束后如需升级，Agent 必须在单独的契约维护步骤中先核对同一 Run 的 `run-metadata.json`、Contract/部署关联和原生报告，再显式执行 `set --operation ... --request-profile ... --level L3 --evidence ".aiprod-local/test-reports/karate/.../karate-summary.html"`；L3 没有证据会被拒绝。

普通接口使用 `{METHOD} {path}`；统一分发变体使用构建器生成的 `{METHOD} {path}#{variant_id}`，例如 `POST /external/access#resource.create`。

支持 `--dry-run`。所有路径必须位于项目根目录内。

稳定性约束：接口键不变时 `operation_id` 不变；上游 `operationId`、验证状态和来源证据不参与接口指纹。重复构建与同步不得清除指纹未变的校准结果。修改 ID 或指纹算法前必须验证已有契约和下游引用的兼容性，不得把算法变化作为接口变化写回产品工作区。

当前目录项使用 `fingerprint_version: 2`：摘要、描述、标题、标签和示例不参与协议指纹；本地 `$ref` 按模型内容比较，必填项、枚举、参数和组合 schema 的排列不影响指纹。字段名、类型、默认值、约束、鉴权（包含继承的安全方案）、服务地址和响应结构仍参与比较。说明文字中的业务规则变化仍需 Agent 核查，不能由协议指纹判定。

同步遇到不同指纹算法版本（包括旧数据未声明版本）时，在写入前拒绝执行，不把算法差异解释为接口变化或批量清除校准。旧工作区需先单独确认并修正契约基准；本工具不自动迁移或恢复校准状态。
