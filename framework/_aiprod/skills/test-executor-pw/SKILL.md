---
name: test-executor-pw
description: 由 playwright-testing-pw Routine 加载；通过 playwright_test_run 执行 API、UI 或混合测试并维护 testing-pw 结果。
metadata:
  entrypoint: routine
  owner_routine: playwright-testing-pw
---

# Playwright 测试执行

## 执行规则

1. 正式测试仅执行已审核 `testing-pw/test-cases.md`；simulation 使用用户当前明确目标，不登记交付报告。
2. 正式测试先运行 `playwright_test_asset_check`，再用相同目标执行 `playwright_test_run --list`。列表成功只证明测试发现与模块加载，不是业务通过。
3. 从产品根目录调用 `playwright_test_run`，不得直接调用 Playwright CLI或自行创建报告目录。
4. 默认 `--workers 1`、Playwright 整体重试为 0。只有负责人明确要求，且后台业务数据、账号和页面上下文均隔离时才提高并发。
5. API 用例使用 `api` Project；UI/混合用例按指定浏览器 Project 执行。不能以 Chromium 通过代替明确要求的其他浏览器。
6. 退出码非零、断言失败或最终状态无证据均不能标记通过。运行器、环境、权限或浏览器无法启动为 `blocked`；目标行为已发生且断言失败为 `failed`。
7. 先使用 HTML 报告与 Trace 定位失败步骤、DOM、请求和附件；不足时再读取 JSON 报告或相关日志片段。不得为通过而修改预期或跳过用例。
8. 正式运行由工具自动追加 `testing-pw/test-runs.md`。随后用 `delivery_test_report --engine pw` 更新用例与 BUG；问题涉及代码时，问题说明直接引用源码 Git 仓库根目录相对路径，建议带行号。
9. 功能问题初始为`待审核`；仅复测负责人标记为`待复测`的 BUG。Healer 建议不能替代负责人对产品缺陷、跳过和预期变化的判断。

失败修复后先执行最小失败范围，再执行原批次；会消费状态的测试重新准备独立数据。详细参数直接读取 `_aiprod/tools/playwright_test_run/README.md`。
