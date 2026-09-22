# Playwright-pw 测试资产

本目录保存跨 Product Change 和独立测试范围复用的 Playwright/TypeScript 测试资产。具体测试 Spec 和最终断言留在对应 `testing-pw/tests/`，运行报告留在 `.aiprod-local/`。

标准目录按“资产类型 → 业务域”组织；目录在出现真实资产时按需创建，不为空结构预建占位文件：

```text
api_test_scenarios-pw/
├── index.md
├── config/
│   └── playwright.config.ts
├── support/
│   ├── assets.ts
│   ├── test.ts
│   └── fixtures/                  # 自定义 Fixture 较多时按需拆分
├── actions/
│   └── {domain}/
│       ├── {action-id}.ts
│       └── {action-id}.README.md # 仅在调用者需要使用说明时创建
├── flows/
│   └── {domain}/
│       └── {flow-id}/
│           ├── flow.ts
│           ├── profiles.json     # 仅在 Flow 有标准数据基线时创建
│           ├── internal/         # 仅在 Flow 私有实现确需拆分时创建
│           └── README.md         # 调用者需要额外使用说明时按需创建
├── pages/
│   └── {domain}/
│       ├── {page-id}.ts
│       └── {page-id}.README.md   # 仅在调用者需要使用说明时创建
├── components/
│   └── {domain-or-common}/
│       ├── {component-id}.ts
│       └── {component-id}.README.md # 仅在调用者需要使用说明时创建
├── knowledge/
│   ├── README.md
│   └── {domain-or-topic}.md       # 有已验证经验时按需创建
├── shared-data/
│   └── {domain}/
│       └── {entity-type}.json   # 多个 Flow 共享且身份稳定的业务实体
└── utils/                        # 无业务语义的纯计算或转换
```

Action、Flow、Page、Component 是公共业务资产；其中 `flow.ts` 是一个 Flow 的唯一公共入口，`profiles.json` 和 `internal/` 均从属于该 Flow。跨业务域复用的 Component 放在 `components/common/`，不要为潜在复用提前拆分。

资产说明按需沉淀。代码注释服务实现维护，公开资产不要求逐一有 README。多个输入参数的效果或组合不同、存在可选 Profile/阶段、特殊前置条件、副作用、清理/幂等/并发约束或其他调用注意事项，且调用者只看公开接口仍可能误用时，才添加面向调用者的 README。Flow 使用目录内 `README.md`；Action、Page、Component 使用与源码同名的 `.README.md`。README 只说明用途、公开输入输出及其效果、阶段或 Profile、关键约束和调用范围，不复制代码、契约登记、最终断言、凭据或运行结果。

可执行定位器、导航和页面操作维护在 Page 或 Component；定位选择依据、复杂控件行为、可靠等待信号、权限差异和已复现诊断经验维护在 `knowledge/{domain-or-topic}.md`。具体格式与沉淀门槛见 `knowledge/README.md`。

## Shared Data

Shared Data 使用 UTF-8 JSON，一个文件只维护一种实体类型。顶层格式固定为：

```json
{
  "schemaVersion": 1,
  "entityType": "sku",
  "records": {
    "default-sku": {
      "skuCode": "TEST-SKU-001",
      "productCode": "TEST-PRODUCT-001"
    }
  }
}
```

文件放在 `shared-data/{domain}/{entity-type}.json`，例如 `shared-data/catalog/skus.json`。`records` 的键是稳定的 kebab-case 别名，值是该实体的业务字段；长整型 ID 使用字符串。调用者选择记录后先深拷贝，不修改共享对象。可复制 `_aiprod/skills/api-test-asset-maintainer-pw/assets/shared-data.json` 起步。

只有跨多个 Flow 使用、在目标环境中保持相同业务身份且不会被测试改变的既存实体才进入这里。账号和密钥、环境地址及环境相关 ID、运行态业务对象、Flow 请求基线、状态枚举和接口数据字典均不属于 Shared Data。

`index.md` 由 `playwright_test_asset_check --write-index` 维护。该工具校验公共元数据、相对导入和 Contract 引用，但不强制验证目录示例；新增和整理资产时由维护者遵循本 README 与 `_aiprod/skills/api-test-asset-maintainer-pw/SKILL.md`。
