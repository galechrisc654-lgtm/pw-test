# api_contract_registry

依据维护版接口目录维护逐接口或分发变体的稳定 `operation_id`、契约验证状态、验证等级和具名请求格式，并同步生成 Markdown 索引。`registry.json` 和 `index.md` 必须由本工具写入，不得手工编辑。`operation_id` 统一按规范接口键生成 `op_{base64url(key)}`，不使用上游 OpenAPI 的 `operationId`；API 维护流程独立产出，下游只消费。

首次或每次获取后同步：

```powershell
node .\_aiprod\runtime\aiprod-launcher.cjs run api_contract_registry sync --catalog resources/api_contracts/{service_id}/operations.json --registry resources/api_contracts/{service_id}/registry.json --index resources/api_contracts/{service_id}/index.md --project-root .
```

从 v2 升级到 v3 时，先从升级前的 Git 版本导出 `openapi.resolved.json`。如果当前 `registry.json` 已被地址变化错误重置，还要同时导出升级前的 `registry.json`。先 dry-run：

```powershell
node .\_aiprod\runtime\aiprod-launcher.cjs run api_contract_registry migrate-fingerprint `
  --catalog resources/api_contracts/{service_id}/operations.json `
  --registry resources/api_contracts/{service_id}/registry.json `
  --index resources/api_contracts/{service_id}/index.md `
  --previous-document .aiprod-local/migration/{service_id}/openapi.resolved.v2.json `
  --previous-registry .aiprod-local/migration/{service_id}/registry.v2.json `
  --dry-run --project-root .
```

确认迁移摘要后去掉 `--dry-run` 执行。当前 registry 尚未被错误重置时可省略 `--previous-registry`，工具会把 `--registry` 自身作为旧基准。迁移先验证旧 registry 的每个有效接口都与旧维护版文档的 v2 指纹一致，再用 v3 比较旧、新结构：结构未变的接口保留状态、等级、证据、具名 profile 和验证时间，把原 v2 指纹写入 `compatible_fingerprints`；真实结构变化、新增和删除接口分别按正常同步规则处理且不继承兼容别名。任一旧基准不匹配时整次拒绝且不写文件。`--previous-document` 必须是升级前的维护版 `openapi.resolved.json`，不能用未经 overlay/supplement 合成的原始文档替代。

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

当前目录项使用 `fingerprint_version: 3`，表示同一 `{METHOD} {path}` 下的有效调用契约。参与指纹的内容只有：合并继承与 operation 覆盖后的有效参数，请求体，响应状态、响应头与响应体，实际鉴权机制和所需 scope，以及 callback 协议；统一分发变体另包含 selector 和变体请求模型。本地 `$ref` 按被引用模型内容比较，字段名、类型、格式、必填、默认值、枚举、约束、媒体类型、参数序列化方式及组合 schema 等会影响指纹。集合型排列不影响指纹，参数只在 path 与 operation 之间移动且有效定义未变时也不影响指纹。

以下内容不参与指纹：`servers`、OAuth/OpenID 环境 URL、`operationId`、摘要、描述、标题、标签、示例、`externalDocs`、`deprecated`、验证状态、来源证据、任意 `x-*` 生成器扩展，以及仅用于说明认证载荷的 `bearerFormat`。这些内容仍保留在 OpenAPI 文档中；服务地址和认证端点属于环境与部署配置，API 测试目标继续由运行时 `base_url` 和认证配置独立决定。说明文字中的业务规则变化仍需 Agent 核查，不能由协议指纹判定。

普通 `sync` 遇到不同指纹算法版本（包括旧数据未声明版本）时，在写入前拒绝执行，不把算法差异解释为接口变化或批量清除校准。v2 到 v3 只能通过上述显式迁移动作完成，不得把算法升级产生的差异记为业务契约变化。

`compatible_fingerprints` 只用于同一 service、同一 operation 的历史资产引用解析。检查器仍以当前 operation 的 `active + verified + L2 以上` 和 `verified_fingerprint` 为准；兼容别名不能恢复失效验证。普通 `sync` 一旦识别出真实契约变化或删除接口，会清除该 operation 的全部兼容别名。新建和后续维护的资产必须写当前 v3 指纹，历史别名只随旧资产自然淘汰。
