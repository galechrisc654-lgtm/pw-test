---
name: api-test-designer-pw
description: 由 playwright-testing-pw Routine 加载；使用 Playwright APIRequestContext、TypeScript Action 和 Flow 设计 API 测试。
metadata:
  entrypoint: routine
  owner_routine: playwright-testing-pw
---

# Playwright API 测试设计

正式测试以 `testing-pw/test-cases.md` 中已审核用例为唯一业务预期；simulation 以用户当前明确目标为准。Contract 决定服务端接受什么，匹配部署版本的消费者实现还原实际调用，已有可运行资产提供工程证据，四者不能互相替代。

## 设计规则

- 顶层测试使用 `*.api.spec.ts`，导出字面量 `aiprod` 元数据，包含 `caseId`、`title`、`mode: 'api'` 与当前文件直接使用的 Contract。
- 使用 Playwright `request` 或项目自定义 API Fixture；使用 AIProd Fixture 时从 `resources/api_test_scenarios-pw/support/test.ts` 导入 `test`、`expect`。每个测试保持独立，不依赖执行顺序或可消费共享数据。
- 先检索 `resources/api_test_scenarios-pw/index.md`。完全匹配时复用 Action/Flow；部分匹配时让 Flow 停在最小充分阶段，再在当前测试补齐差异。
- Action 是显式参数到稳定业务结果的普通异步函数；Flow 组合 Action 准备可核验状态。不得另造 YAML 步骤树、全局变量注册表或解释器。
- Profile 是所属 Flow 同目录 `profiles.json` 中的标准数据基线。目标阶段、实例数量和用例差异通过函数参数及 override 表达；多实例分别物化，写入或消费型测试使用独立数据。
- 使用 `test.step` 标记可诊断的业务步骤。断言覆盖 HTTP 状态、业务成功语义、关键返回值和最终业务状态；TypeScript 类型不能替代运行时断言。
- 状态轮询使用有界轮询；写操作重试必须确认幂等性或先查询当前状态，不使用整条测试重试掩盖副作用。
- 模块顶层不得发送请求或修改环境，保证 `--list` 和静态加载无副作用。
- 发现稳定的跨测试能力时读取 `_aiprod/skills/api-test-asset-maintainer-pw/SKILL.md`；用例特有异常和最终验收断言留在当前测试。

正式输出前调用 `playwright_test_asset_check`，再调用 `playwright_test_run --list`。真实运行与报告规则直接读取 `_aiprod/skills/test-executor-pw/SKILL.md` 和 `_aiprod/tools/playwright_test_run/README.md`。
