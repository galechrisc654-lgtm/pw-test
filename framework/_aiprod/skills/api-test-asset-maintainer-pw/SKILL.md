---
name: api-test-asset-maintainer-pw
description: 维护产品工作区跨测试复用的 Playwright/TypeScript Action、Flow、Page、Component、Shared Data、运行支持 Fixture 和公共测试知识。
---

# Playwright 公共测试资产维护

维护 `resources/api_test_scenarios-pw/`：公共业务资产包括 Action、Flow、Page 和 Component；Flow 的 Profile 与 `internal/` 是其从属资料；Shared Data、Utils 和 Playwright 原生 Fixture 提供跨测试支持。Contract、消费者实现、已有运行资产和已审核预期分别说明接口能力、实际调用、工程用法与业务目标，不能互相替代。

创建或修改资产前必须读取 [references/asset-rules.md](references/asset-rules.md) 和产品工作区 `resources/api_test_scenarios-pw/README.md`。新增公共资产分别从 [assets/action.ts](assets/action.ts)、[assets/flow.ts](assets/flow.ts)、[assets/page.ts](assets/page.ts) 或 [assets/component.ts](assets/component.ts) 起步；新增 Flow Profile 使用 [assets/profile.json](assets/profile.json)，新增 Shared Data 使用 [assets/shared-data.json](assets/shared-data.json)。需要统一注入环境、认证、API 客户端或 Page Object 时，扩展产品工作区已有的 `resources/api_test_scenarios-pw/support/test.ts`。

维护时定向检索 `index.md`、同领域资产、调用者和 `knowledge/README.md`。可执行定位器与操作维护在 Page 或 Component；经过验证且跨资产适用的业务、定位、交互、等待和诊断经验维护到 `knowledge/{domain-or-topic}.md`，按 `knowledge/README.md` 记录证据、适用条件和失效边界。不创建空知识文件。

资产说明按需沉淀：代码注释服务实现维护；公开资产有多参数不同效果、特殊前置/副作用或关键使用约束，且调用者只看接口仍可能误用时，才添加面向调用者的 README。具体路径和内容边界见 `references/asset-rules.md`。

修改后调用 `playwright_test_asset_check --write-index`。改变输入输出、阶段、Profile 或 Fixture 时同步处理静态导入调用者，再通过 `playwright_test_run --simulation --list` 验证加载；涉及运行语义或状态推进时执行最短代表性链路。

不维护 API Contract、具体用例最终断言或交付报告；不把真实密钥、认证状态、Trace 或完整响应放入公共资产。
