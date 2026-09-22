# resources

`resources/` 存放当前产品工作区私有、可复用且需要长期维护的源资产。

本目录中的资产不等于当前产品事实：产品规则、功能、流程和数据定义仍以 `specs/` 为准。也不存放仅供一次执行的过程结果。

```text
resources/
  api_contracts/
    api-contracts.example.json
    api-contracts.json
    {service}/
  api_test_scenarios-ka/
    index.md
    config/
      karate-config.js
  api_test_scenarios-pw/
    README.md
    index.md
    config/
      playwright.config.ts
    support/
      assets.ts
      test.ts
  {asset_type}/
    {asset_id}/
```

一级子目录按明确、稳定的资产类型命名，例如 `api_contracts/`、`test_fixtures/`、`test_datasets/`、`design_standards/` 或 `tools/`；只有资产跨多个过程复用、需要独立生命周期且存在明确消费者时才新增类型。一级目录应以 `README.md` 说明用途、输入输出、所有者、适用范围和消费者；单文件资产及其从属目录仅在调用者需要额外使用说明时按其专用规则补充 README。Playwright 公共资产的 README 路径和内容遵循 `api_test_scenarios-pw/README.md`；不得保存密钥、真实令牌或仅供一次执行的临时数据。

| 路径 | 说明 |
| --- | --- |
| `api_contracts/` | API 服务配置以及按服务维护的 OpenAPI 原始快照、校准补丁和契约登记表；不维护测试 Action。 |
| `api_contracts/{service}/` | 单个服务的 API Contract 资料；格式见 `_aiprod/skills/api-contract-maintainer/references/artifact-format.md`。 |
| `api_test_scenarios-ka/` | Karate 公共测试资产库；`config/karate-config.js` 是框架初始化的环境入口，其余内容按业务领域组织 Action、少量 Fixture、Profile、Template、Utils 和共享基础数据，不放具体测试工作流。维护规则见 `_aiprod/skills/api-test-asset-maintainer-ka/SKILL.md`。 |
| `api_test_scenarios-ka/index.md` | 由 `karate_test_asset_check --write-index` 根据公共 Feature 生成的资产目录，不是 Test Run 索引。 |
| `api_test_scenarios-pw/` | Playwright/TypeScript 公共测试资产库；以该目录 `README.md` 的“资产类型 → 业务域”示例组织 Action、Flow、Page、Component 和运行支持。具体测试 Spec 不放在这里。维护规则见 `_aiprod/skills/api-test-asset-maintainer-pw/SKILL.md`。 |
| `api_test_scenarios-pw/index.md` | 由 `playwright_test_asset_check --write-index` 根据静态元数据生成的资产目录，不是 Test Run 索引。 |
| `tools/{tool_id}/` | 仅适用于当前产品、不能上升为 AIProd 内置工具的可复用工具；工具目录须说明调用方式和权限边界。 |

`api-contracts.example.json` 由框架初始化和更新；实际配置文件由产品工作区维护。原始 OpenAPI 快照不得人工修改；Contract 的 `registry.json` 和服务级 `index.md` 必须由 `api_contract_registry` 写入。
