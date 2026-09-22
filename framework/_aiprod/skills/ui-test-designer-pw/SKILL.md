---
name: ui-test-designer-pw
description: 由 playwright-testing-pw Routine 加载；在 AIProd 业务边界内使用 Playwright 官方 Planner 和 Generator 设计 UI 或混合测试。
metadata:
  entrypoint: routine
  owner_routine: playwright-testing-pw
---

# Playwright UI 与混合测试设计

使用当前固定 Playwright 版本通过 `init-agents --loop=codex` 生成的官方 Planner、Generator；官方定义负责探索真实页面、验证定位器和生成 Playwright 测试，本 Skill 只补充产品工作区中不可缺少的业务与治理边界。

## 输入与模式

已审核 `testing-pw/test-cases.md` 决定预期。先把目标固定为一种模式：

- `ui`：被测动作和用户可见结果通过页面完成与验证；使用 `*.ui.spec.ts` 和 `mode: 'ui'`。
- `hybrid`：只按 `API Arrange → UI Act → UI Assert → API Assert` 组合；使用 `*.hybrid.spec.ts` 和 `mode: 'hybrid'`。

不得用 API 替代用例要求验证的页面行为。API 只负责高成本前置状态、清理和页面不能充分证明的服务端后置条件。若用例只验证 API，退出本 Skill，改用 `api-test-designer-pw`。

## 官方 Agent 接入

- 为目标业务建立最小 `seed.spec.ts`，只提供页面入口、认证、自定义 Fixture 和必要前置；Seed 不承载目标用例断言。
- Planner 可以读取 PRD、已审核用例和 Seed，探索与目标相关的页面，不自行扩大业务范围。
- Generator 从确认后的 Markdown 计划生成测试，优先使用 role、label、placeholder、text、test id 等面向用户的定位方式，并实时核验定位器。
- 生成结果必须导出字面量 `aiprod` 元数据并保持 Spec 与用例可追溯；一个测试尽量对应一个业务场景。
- 页面封装只维护稳定定位和页面动作，跨 Page 复用的复杂控件使用 Component，不隐藏测试专属断言；API Action/Flow 从公共资产导入。使用 AIProd Fixture 时从 `resources/api_test_scenarios-pw/support/test.ts` 导入 `test`、`expect`。
- 探索页面前读取 `resources/api_test_scenarios-pw/knowledge/README.md` 和目标领域已有 Knowledge；复用其中已验证的定位依据、控件行为和等待信号，但定位器与操作实现仍落入 Page 或 Component。
- 认证状态文件、Cookie、Token、Trace 和页面数据均视为敏感本地运行资产，不提交、不在对话或报告中回显。

## Healer 限制

官方 Healer 只能作为诊断和测试代码修复辅助。它不得自行放宽业务断言、改变已审核预期、把 UI 动作换成 API、修改业务数据含义，或用 `test.skip`/`test.fixme` 消除产品失败。只有证据确认属于定位器、等待、Fixture 或测试实现缺陷时才能修改并复验；产品行为偏差进入 BUG 流程，跳过与预期变化需负责人确认。

完成后调用 `playwright_test_asset_check` 与 `playwright_test_run --list`，真实执行规则直接读取 `_aiprod/skills/test-executor-pw/SKILL.md` 和 `_aiprod/tools/playwright_test_run/README.md`。
