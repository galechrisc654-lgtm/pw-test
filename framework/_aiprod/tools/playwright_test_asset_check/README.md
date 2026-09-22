# Playwright Test Asset Check

`playwright_test_asset_check` 使用 TypeScript AST 读取导出的字面量 `aiprod` 元数据，并检查 PW 公共资产与正式测试的分层、ID、相对导入和直接 Contract 引用。它不执行模块，因此不会触发测试代码副作用。

```powershell
node .\_aiprod\runtime\aiprod-launcher.cjs run playwright_test_asset_check `
  --target resources/api_test_scenarios-pw `
  --write-index `
  --project-root .
```

省略 `--target` 时同时检查公共资产以及 Change、独立范围中的 `testing-pw/tests/`。`--write-index` 只根据公共资产重建 `resources/api_test_scenarios-pw/index.md`。

Action 必须声明直接 Contract；Action、`flows/{domain}/{flow-id}/flow.ts`、Page、Component 必须声明稳定 ID。Flow 的 `profiles.json`、`internal/` 及 `support/` 模块不进入公共资产索引。正式 Spec 必须声明 `caseId` 和 `mode: api|ui|hybrid`。动态导入和运行时构造的元数据不作为可验证声明，应改为静态字面量。目录组织示例见 `resources/api_test_scenarios-pw/README.md`，本工具不强制验证目录方向。检查通过只说明可检查规则一致，不代表 TypeScript 类型正确或业务运行通过。
