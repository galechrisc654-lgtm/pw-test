# playwright_runtime

`playwright_runtime` 管理当前用户下由 AIProd 固定版本的共享 Playwright Runtime。Runtime 位于用户级 AIProd 数据目录，不写入产品工作区；多个产品工作区共用同一版本的 `@playwright/test` 和浏览器。

查询状态：

```powershell
node .\_aiprod\runtime\aiprod-launcher.cjs run playwright_runtime status --project-root .
```

首次安装或修复固定 Runtime，并默认安装 Chromium：

```powershell
node .\_aiprod\runtime\aiprod-launcher.cjs run playwright_runtime install --project-root .
```

可重复 `--browser` 安装指定浏览器；只安装测试运行时而暂不安装浏览器时使用 `--no-browser`：

```powershell
node .\_aiprod\runtime\aiprod-launcher.cjs run playwright_runtime install --browser chromium --browser firefox --project-root .
node .\_aiprod\runtime\aiprod-launcher.cjs run playwright_runtime install --no-browser --project-root .
```

Runtime 版本由当前 AIProd 框架固定，工具不会选择网络上的最新版。产品工作区不得为此创建 `package.json`、锁文件或 `node_modules`，也不得手工修改共享 Runtime。升级由 AIProd 框架版本变更和本工具安装共同完成。

共享 Runtime 只承载 Playwright 程序与浏览器，不承载产品测试资产、环境配置、账号、报告或运行状态。Agent 的工作目录仍是当前产品工作区。
