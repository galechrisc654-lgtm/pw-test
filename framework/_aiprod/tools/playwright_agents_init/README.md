# Playwright Agents Init

`playwright_agents_init` 使用 AIProd 用户级共享 Playwright Runtime 生成官方 Codex Planner、Generator、Healer，把 MCP 命令绑定到该 Runtime，并追加 AIProd 治理覆盖规则。Agent 文件仍安装在当前产品工作区，因此读取和修改的是当前产品上下文。

```powershell
node .\_aiprod\runtime\aiprod-launcher.cjs run playwright_agents_init `
  --integration example_playwright `
  --project-root .
```

工具只接受启用的 `playwright-cli-pw` integration，并要求先安装 `playwright_runtime`。它不会联网选择版本，实际版本由当前 AIProd 框架固定。Playwright 首次生成的 `seed.spec.ts` 由产品工作区维护，后续可按 UI 测试入口补充认证与 Fixture。

同名文件只有能识别为 Playwright 官方 Agent 时才会重新生成；疑似自定义 Agent 会拒绝覆盖。重新生成会刷新官方主体并重新添加治理覆盖，因此 Playwright 升级后应再次调用本工具。

治理覆盖限制官方 Healer：不得放宽已审核预期、改变业务含义、把 UI 行为替换为 API，或使用 `skip`/`fixme` 掩盖产品失败。生成文件位于产品工作区 `.codex/agents/`，由现有忽略规则保持在本地，不提交产品 Git。
