# API Contract Artifact Format

## 存放结构

每组接口契约使用独立的稳定标识。该标识表示逻辑 API 服务或契约集合，不表示 AIProd 产品项目，也不限定 WMS 等业务类型：

```text
resources/api_contracts/{service}/
  openapi.raw.json
  source.json
  changes.json
  openapi.supplement.json
  overlays.json
  operations.json
  registry.json
  index.md
  openapi.resolved.json
  resolved.metadata.json
```

产品级配置位于同一根目录：

```text
resources/api_contracts/
  api-contracts.example.json
  api-contracts.json
  {service}/
```

- `openapi.raw.json`：最近一次发生语义变化的服务端原始响应，不得人工修改。
- `source.json`：OpenAPI 环境、获取时间和哈希。
- `changes.json`：测试环境原始 OpenAPI 相对上次快照的新增、变化、移除和未变化接口。
- `openapi.supplement.json`：Agent 基于代码和适用运行时证据维护的缺失接口补充，不存在缺失接口时可省略。
- `overlays.json`：Agent 基于证据维护的 JSON Patch 补丁。
- `operations.json`：工具从 `openapi.resolved.json` 对应的维护版契约生成的接口或业务变体目录、稳定 `operation_id` 与指纹。
- `registry.json`：逐接口生命周期、验证状态、验证等级和具名请求格式，只能由 `api_contract_registry` 写入。
- `index.md`：登记表的人类可读视图，由登记工具同步生成。
- `openapi.resolved.json`：原始文档应用补丁后的完整标准 OpenAPI。
## 产品级配置

`api-contracts.example.json` 由框架提供，复制为 `api-contracts.json` 后作为实际配置。实际配置是产品工作区拥有的普通 JSON，不依赖 AIProd 对象：

```json
{
  "version": 1,
  "defaults": {
    "environment": "test",
    "timeout_ms": 30000,
    "output_root": "resources/api_contracts"
  },
  "code_roots": [
    {
      "id": "primary-backend",
      "path": "${local:PRIMARY_BACKEND_SOURCE_ROOT}",
      "commit": "0123456789abcdef0123456789abcdef01234567"
    },
    {
      "id": "primary-frontend",
      "path": "${local:PRIMARY_FRONTEND_SOURCE_ROOT}"
    }
  ],
  "services": [
    {
      "id": "primary-api",
      "name": "主要 API 服务",
      "enabled": true,
      "document_source": {
        "url": "${local:PRIMARY_OPENAPI_DOCUMENT_URL}",
        "headers": {}
      }
    }
  ]
}
```

- `defaults`：所有服务共享的 `environment`、`timeout_ms` 和 `output_root`。
- `code_roots[].id`：稳定、唯一的代码源标识。
- `code_roots[].path`：本机仓库或源码根目录，可以同时配置前端、后端、网关、SDK 和共享类型仓库；Agent 自行识别角色和相关性。
- `code_roots[].commit`：可选的完整 40 位 Git SHA。存在时固定读取该版本；未明确提供其他版本线索时，先按 `verification-rules.md` 确认 `dev` 分支对应的 commit；仅在已确认当前工作树就是该 commit 时读取当前工作树。
- `services[].id`：稳定、唯一的契约服务标识。
- `services[].name`：人类可读名称。
- `services[].enabled`：是否默认参与维护。
- `services[].environment`、`timeout_ms`：可选的服务级覆盖值。
- `services[].document_source.url`、`headers`：OpenAPI 文档获取配置。

配置值支持 `${local:NAME}`、`${secret:NAME}`、`${env:NAME}` 和 `${project_root}`。本机地址与代码路径默认写入 `secrets.local.json` 的 `locals`，认证值写入 `secrets`；环境变量只作为 CI 或临时覆盖方式。API 测试使用的 `base_url` 和认证是另一组运行时配置，不由 OpenAPI 获取地址或文档中的 `servers` 自动决定。

`openapi_fetcher` 也支持单服务配置文件或完整命令参数，便于脱离产品级清单独立使用；这不改变产品级配置作为 Skill 默认入口。

## 代码校准基准

每个代码源直接声明校准所用版本：

```json
{
  "code_roots": [
    {
      "id": "primary-backend",
      "path": "${local:PRIMARY_BACKEND_SOURCE_ROOT}",
      "commit": "0123456789abcdef0123456789abcdef01234567"
    }
  ]
}
```

标签、构建版本、分支与时间或单独时间只在对话中提供给 Agent。Agent 获授权后解析并确认最终 commit，再写入对应项；无法可靠确定时不写候选值。省略 `commit` 表示需按 `verification-rules.md` 解析默认 `dev` 基准，不表示可以任意采用当前工作树；API 文档与代码、测试环境的对应关系必须在执行证据中明确。

旧版字符串形式仍可读取，并等价于未设置 commit、按默认 `dev` 基准解析的模式：

```json
"code_roots": ["${local:PRIMARY_BACKEND_SOURCE_ROOT}"]
```

需要写入固定 commit 时，应把对应字符串迁移为带 `id`、`path` 和 `commit` 的对象。

## 校准补丁

`overlays.json` 使用受限 JSON Patch：

```json
{
  "version": 1,
  "patches": [
    {
      "op": "replace",
      "path": "/components/schemas/Example/properties/updaterName/description",
      "value": "更新人姓名"
    }
  ]
}
```

允许 `add`、`replace`、`remove`。JSON Pointer 中的 `~` 和 `/` 分别写作 `~0` 和 `~1`。补丁依据记录在对应登记项和本次报告中；不得用补丁掩盖无法判断的矛盾。

补丁修改现有 operation 或共享模型时，验证证据必须覆盖补丁后的契约。缺失的新入口不使用大段 path Patch，改由补充契约维护。

## 代码补充契约

`openapi.supplement.json` 使用可合并的 OpenAPI 片段：

```json
{
  "version": 1,
  "evidence": {
    "POST /external/access#resource.create": [
      "repo=backend; mode=commit; resolved=<完整 SHA>; evidence=<入口、分发器、处理器和请求模型路径>"
    ]
  },
  "paths": {
    "/external/access": {
      "post": {
        "operationId": "externalAccess",
        "summary": "统一外部接入",
        "x-api-contract-variants": [
          {
            "id": "resource.create",
            "selector": {
              "location": "body",
              "path": "$.method",
              "equals": "resource.create"
            },
            "schema_ref": "#/components/schemas/ResourceCreateEnvelope"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ResourceCreateEnvelope"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功"
          }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "ResourceCreateEnvelope": {
        "type": "object"
      }
    }
  }
}
```

- `paths` 和 `components` 使用 OpenAPI 3.x 对应对象结构。
- `evidence` 的键使用普通接口键，统一分发变体使用 `{METHOD} {path}#{variant_id}`。
- 补充 operation 与原始 OpenAPI 的 method + path 重复时构建失败，必须显式迁移或转为 Patch。
- 构建器为补充 operation 写入 `x-api-contract-source`，证据变化不改变协议指纹。
- `x-api-contract-variants` 用于同一 method + path 下的稳定业务分发变体。每项必须有唯一 `id`，以及包含 `location`、`path`、`equals` 的 `selector`；可用 `schema_ref` 指向该变体的具体请求模型。
- 普通 operation 的接口键仍为 `{METHOD} {path}`；变体键为 `{METHOD} {path}#{variant_id}`，各自独立计算指纹和登记状态。

## 接口键与状态

普通接口唯一键采用 `{METHOD} {path}`，例如 `POST /api/orders`。统一分发变体采用 `{METHOD} {path}#{variant_id}`。方法大写，路径保持 OpenAPI 原值，变体 ID 在同一 operation 内稳定且唯一。

每个目录项都具有可供下游稳定引用的 `operation_id`，统一按规范接口键生成 `op_{base64url(key)}`，不使用上游 OpenAPI 的 `operationId`。`api_contract_registry sync` 对旧目录和旧 registry 使用同一规则补齐；API 维护流程独立产出该标识，下游只消费，不参与命名或迁移。

验证状态：`pending`、`verified`、`blocked`、`conflict`。验证等级：`L0`、`L1`、`L2`、`L3`。生命周期：`active`、`deprecated`、`removed`。三者不得合并成一个字段；历史 `verified` 缺少等级时按 L2 兼容。

非默认请求线格式登记在 operation 的 `request_profiles`。profile ID 在该 operation 内稳定唯一；profile 至少包含 `verification_level`，可包含查询字段序列化、执行器适配、证据和说明。测试资产只保存 profile ID，不复制序列化事实。profile 的 L3 只对当前 operation fingerprint 和该 profile 有效。

验证只对当前 `fingerprint` 有效。同步时只要指纹变化，旧的 `verified` 自动失效并回到 `pending`。

## 源码版本证据

不新增专用状态文件。源码版本定位结果写入对应接口的证据摘要，并在本次维护报告中集中列出。建议使用稳定、可检索的单行格式：

```text
repo=<代码源 ID>; mode=commit; resolved=<完整 commit SHA>; requested=<可选用户线索>; method=<可选解析方式>; confidence=<confirmed|inferred|unknown>
repo=<代码源 ID>; mode=working-tree; head=<HEAD SHA>; branch=<当前分支>; dirty=<true|false>
```

时间定位证据必须另外保留带时区的时间。多个仓库分别记录，不得只记录一个全局 commit；工作树存在相关未提交修改时，不能只记录 HEAD。
