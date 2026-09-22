# Playwright Test Run

`playwright_test_run` 在当前产品工作区上下文中，通过 AIProd 用户级共享 Runtime 执行固定版本 Playwright；`playwright-cli-pw` integration 只提供当前产品环境。工具输出 HTML、JSON、Trace/附件、日志和无密钥 `run-metadata.json`，正式运行自动追加 PW Test Run。

## 正式运行

```powershell
node .\_aiprod\runtime\aiprod-launcher.cjs run playwright_test_run `
  --integration example_playwright `
  --change PC-20260914-001 `
  --test changes/PC-20260914-001/testing-pw/tests `
  --project api `
  --scope "API 回归" `
  --workers 1 `
  --project-root .
```

独立范围使用 `--testing-dir work/testing/{test_id}`。重复 `--test` 或 `--project` 可组成批次，`--grep` 进一步筛选。真实 Change/独立运行必须先初始化 `delivery_test_report --engine pw` 并传 `--scope`。

## 无副作用发现与 simulation

增加 `--list` 只发现和加载测试，不登记 Run；模块顶层必须无请求和外部状态副作用。

```powershell
node .\_aiprod\runtime\aiprod-launcher.cjs run playwright_test_run `
  --integration example_playwright `
  --simulation `
  --test .aiprod-local/playground/session/example.api.spec.ts `
  --project api `
  --list `
  --project-root .
```

## 输出

报告位于 `.aiprod-local/test-reports/playwright/`：正式 Change/独立测试区分 `runs/` 与 `dry-runs/`，simulation 使用 `simulations/`。每次创建新的 `TR-PW-*` 目录，不覆盖历史运行。HTML 首页为 `html/index.html`，JSON 为 `results.json`。

成功时只读取工具紧凑结果。失败先查看 HTML 与 Trace，必要时再读取 JSON 或日志相关片段。运行子进程通过环境变量取得 integration 数据；测试不得输出账号、Token、Cookie、认证状态文件或完整敏感响应。

`--list` 不是业务 dry-run，不验证异步函数内部语义。正式运行默认 `--workers 1`；并发必须同时满足用户明确要求和业务数据隔离。
