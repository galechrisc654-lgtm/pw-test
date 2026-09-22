# Playwright CLI-pw Adapter

本 Adapter 连接 AIProd 用户级共享的固定版本 `@playwright/test`。执行由 `playwright_test_run` 负责，业务流程由 `playwright-testing-pw` Routine 决定；Agent 的工作目录和上下文仍是当前产品工作区。

## 依赖与版本

产品工作区不安装 Playwright，不为测试运行时创建 `package.json`、锁文件或 `node_modules`。首次使用时调用 `playwright_runtime install`，由 AIProd 在当前用户的数据目录安装框架固定版本及所选浏览器；后续产品工作区共享该 Runtime。执行工具不会通过网络临时下载最新版。

官方 Playwright Test Agents 必须通过 AIProd 工具按共享 Runtime 的固定版本生成：

```powershell
node .\_aiprod\runtime\aiprod-launcher.cjs run playwright_agents_init --integration {integration_id} --project-root .
```

工具内部调用官方 `init-agents --loop=codex`，把生成的 MCP 命令改为共享 Runtime，再追加 AIProd 的范围、混合模式和 Healer 限制。这些 Agent 定义安装在当前产品工作区 `.codex/agents/`，因此 Agent 仍从当前产品上下文工作。Playwright 升级后按官方要求重新生成，再核对本 Adapter 的治理覆盖规则。不得把某个版本生成的官方提示词复制成 AIProd 长期规则。

## Integration

```json
{
  "adapter": "playwright-cli-pw",
  "enabled": true,
  "params": {
    "agent_project": "chromium",
    "default_environment": "test",
    "environments": {
      "test": {
        "base_url": "https://api.test.example.com",
        "web_base_url": "https://test.example.com",
        "contract_bindings": [{ "service": "primary-api", "environment": "test" }],
        "deployment": { "version": "build-1" },
        "variables": { "tenant_id": 1 },
        "accounts": { "administrator": { "username": "${secret:TEST_USER}", "password": "${secret:TEST_PASSWORD}" } }
      }
    }
  }
}
```

每个 `playwright-cli-pw` Integration 只描述一个目标服务及其环境、账号和 Contract 绑定。不同服务使用不同 Integration ID；运行时通过 `--integration` 选择目标服务，不在环境根节点共享多服务账号。

环境以 `AIPROD_PW_ENV_JSON` 注入子进程，只能在运行时读取。测试、附件、Trace、日志和报告不得主动输出账号、Token、Cookie 或完整认证状态。

## 调用边界

- Agent 必须通过 `playwright_test_run` 执行，不直接调用 Playwright CLI。
- 项目配置入口固定为 `resources/api_test_scenarios-pw/config/playwright.config.ts`。
- `.api.spec.ts` 由 `api` Project 执行；`.ui.spec.ts` 和 `.hybrid.spec.ts` 默认由 `chromium` Project 执行。增加浏览器 Project 时不得让 API 用例被重复执行。
- HTML、JSON、Trace、截图和日志写入 `.aiprod-local/test-reports/playwright/` 的独立 Run 目录，不提交 Git。
- `--list` 只验证发现与加载，模块顶层禁止发送请求、准备数据或修改外部状态。
