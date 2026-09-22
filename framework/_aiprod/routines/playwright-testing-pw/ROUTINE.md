---
name: playwright-testing-pw
description: 使用 Playwright 组织正式 API、UI、混合测试，或通过 simulation 完成临时验证和诊断。
---

# Playwright-pw 测试例程

正式测试从当前范围中已明确标记“审核状态：已审核”的 `test-cases.md` 出发。Change 使用 `changes/{change_id}/testing-pw/`；独立测试使用 `work/testing/{test_id}/testing-pw/`。报告工具命令统一增加 `--engine pw`。simulation 使用 `.aiprod-local/playground/{session_id}/`，不要求用例与报告，也不登记 Test Run。

Playwright 原生负责测试发现、Fixture、Project、断言、并发、HTML/JSON 报告和 Trace；不另建步骤解释器。AIProd 负责业务预期、Contract、公共资产边界、环境快照、报告登记和人工决策边界。

Playwright 程序和浏览器来自 AIProd 用户级共享 Runtime，Agent 和执行器仍以当前产品工作区为工作目录。产品工作区不安装测试运行时 `node_modules`；Runtime 缺失时先调用 `playwright_runtime install`。

## 模式路由

每个 Spec 必须只声明一种模式，文件名和 `aiprod.mode` 一致：

- `api` / `*.api.spec.ts`：只验证服务端行为，读取 `_aiprod/skills/api-test-designer-pw/SKILL.md`。
- `ui` / `*.ui.spec.ts`：页面执行被测行为，读取 `_aiprod/skills/ui-test-designer-pw/SKILL.md`。
- `hybrid` / `*.hybrid.spec.ts`：API 准备、UI 执行目标动作、UI 与 API 核验，也读取 `ui-test-designer-pw`。

批次可以包含多种模式，但逐个 Spec 的行为边界不能混淆。正式 UI/混合编写优先使用当前 Playwright 版本生成的官方 Planner、Generator；Healer 受 UI Skill 中的治理限制，不得改变业务预期以换取通过。

## 推进流程

1. 确认用例、目标环境、部署版本、Contract 绑定、测试模式和批次范围，并用 `playwright_runtime status` 检查共享 Runtime。只有用户明确审核同意后才能把用例标记为已审核。
2. 首次进入范围时调用 `delivery_test_report init --engine pw`；用例变化后调用 `sync-test-cases --engine pw`。
3. 调用 `delivery_test_report summary --engine pw` 获取当前状态，不全文读取运行汇总。
4. 按模式读取对应 Designer。先检索 `resources/api_test_scenarios-pw/index.md`，复用最接近的 Action、Flow、Page 或 Component；需要公共维护或 Fixture 支持时读取 `api-test-asset-maintainer-pw`。
5. 只核对本批次直接使用的 operation。公共 Action 的 Contract 必须为当前 `active + verified + L2 以上`，且指纹一致。
6. 调用 `playwright_test_asset_check --write-index` 校验元数据、静态导入、分层和 Contract；再调用 `playwright_test_run --list` 验证发现和加载。两者都不代表业务通过。
7. 读取 `_aiprod/skills/test-executor-pw/SKILL.md` 与 `_aiprod/tools/playwright_test_run/README.md`，先以 `--workers 1` 运行最短代表性链路，再执行原批次。
8. 失败时先用 HTML 和 Trace 区分产品、测试实现、数据、环境与 Contract 问题。测试实现可修复后最小复验；产品偏差保留预期并登记 BUG。
9. 工具自动登记正式 Test Run。用 `delivery_test_report --engine pw update-test-case/add-bug/record-retest` 更新当前状态；涉及代码的问题说明直接引用源码仓库相对路径，建议带行号。
10. 重新读取 summary，继续仍为 `not_run` 且当前模式可验证的用例。只有全部用例到达终态且状态表一致时结束。

## 状态与数据

状态仍使用 `not_run`、`passed`、`failed`、`blocked`、`not_api_testable`、`skipped`。API 无法判定不等于 UI 无法判定；选择 `not_api_testable` 时应评估是否转为 UI/混合，但改变测试模式需记录理由。

浏览器 Context 隔离不能代替后台业务数据隔离。写入或消费型测试必须使用独立订单、包裹、库存和工作记录；未经明确允许不提高并发，不依赖 Spec 顺序共享状态。
