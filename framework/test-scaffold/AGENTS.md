# 测试工作区规则

本工作区只用于 API Contract 与 Playwright 测试工作；不维护产品事实、探索、方案、开发任务或非测试交付资料。

本文件是测试工作区范围的最高优先级入口。进入目录后仍应读取该目录的公共 `README.md`，但如果 README 描述了完整产品工作区的流程、对象或目录，而本文件未授权该内容，以本文件为准；不得因为 README 中存在示例就创建测试工作区未提供的产品资料。

## 工作区能做什么

本工作区支持一条完整的 API/UI 测试闭环：维护 OpenAPI Contract，维护可复用的 Playwright Action、Flow、Page、Component、Fixture 和 Knowledge，编写或评审测试用例，生成 API/UI/混合 Spec，执行测试并维护测试报告、BUG 和复测结果。所有正式测试资料都归属于 `work/testing/{test_id}/`，其中 `test-cases.md` 是业务用例和测试预期的唯一入口，`testing-pw/` 保存 Spec、报告和运行记录。

本工作区不负责产品需求、PRD、产品事实、产品发布或开发任务；测试依据可以在 `test-cases.md` 中记录为需求来源、范围、前置条件、预期和验收标准。需要保存的外部需求材料只能作为测试范围的参考资料，不把它们扩展成产品工作区对象。

## 测试模式速查

进入任何 Playwright 任务后，先读取 `_aiprod/routines/playwright-testing-pw/ROUTINE.md`，再按下列模式加载对应 Skill。一个 Spec 只能选择一种模式，文件名、`aiprod.mode` 和实际行为必须一致：

- **API**：`*.api.spec.ts`，`mode: 'api'`。只通过 API 验证服务端行为；加载 `_aiprod/skills/api-test-designer-pw/SKILL.md`。
- **UI**：`*.ui.spec.ts`，`mode: 'ui'`。必须通过页面完成并验证用户可见行为；加载 `_aiprod/skills/ui-test-designer-pw/SKILL.md`。
- **混合**：`*.hybrid.spec.ts`，`mode: 'hybrid'`。只按“API 准备 → UI 操作 → UI 核验 → 必要的 API 后置核验”组织；加载 `_aiprod/skills/ui-test-designer-pw/SKILL.md`，不得用 API 替代要求验证的 UI 行为。
- **Simulation**：仅用于临时探索、诊断或验证加载，不代表正式测试；不要求已审核用例，不登记 Test Run，不伪造业务通过。

API、UI 和混合测试可以在同一测试范围内组成批次，但每个 Spec 仍必须保持单一模式。正式执行前必须有 `work/testing/{test_id}/test-cases.md`，并明确写有“审核状态：已审核”。

## Skill 加载指引

按任务继续读取，不要一次加载无关 Skill：

1. 所有 Playwright 任务：先读 `_aiprod/routines/playwright-testing-pw/ROUTINE.md`。
2. 维护 Contract：读 `_aiprod/skills/api-contract-maintainer/SKILL.md`，并按其要求读取 Contract 参考资料。
3. 设计用例：读 `_aiprod/skills/test-case-designer/SKILL.md`；评审用例：改读 `_aiprod/skills/test-case-reviewer/SKILL.md`。
4. 维护公共 Action、Flow、Page、Component、Fixture 或 Knowledge：读 `_aiprod/skills/api-test-asset-maintainer-pw/SKILL.md`。
5. 编写 API Spec：读 `api-test-designer-pw`；编写 UI 或混合 Spec：读 `ui-test-designer-pw`。
6. 执行、诊断、登记 BUG 或复测：读 `_aiprod/skills/test-executor-pw/SKILL.md`，并按需读取 `playwright_test_run`、`delivery_test_report` 工具说明。

Skill 只决定当前任务的执行规则；目录归属、测试范围和模式选择以本文件与 Playwright Routine 为准。

## 开始前

1. 以 UTF-8 读取文本。
2. 仅在用户授权的非生产环境执行请求、测试或浏览器操作。
3. 环境、账号、地址和密钥只从 `references/integrations/integrations.json` 与本地 `secrets.local.json` 解析；不得将密钥、Cookie、认证状态或完整敏感响应写入测试资产和报告。

## 路由

- 维护 OpenAPI Contract：读取 `_aiprod/skills/api-contract-maintainer/SKILL.md`。
- 设计或评审测试用例：读取 `_aiprod/skills/test-case-designer/SKILL.md` 或 `_aiprod/skills/test-case-reviewer/SKILL.md`。
- 编写 API、UI 或混合 Spec：读取对应的 `_aiprod/skills/api-test-designer-pw/SKILL.md` 或 `_aiprod/skills/ui-test-designer-pw/SKILL.md`。
- 维护可复用 Action、Flow、Page、Component、Fixture 或 Knowledge：读取 `_aiprod/skills/api-test-asset-maintainer-pw/SKILL.md`。
- 执行、诊断、登记 BUG 或复测：读取 `_aiprod/skills/test-executor-pw/SKILL.md`，再按需读取 `_aiprod/tools/playwright_test_run/README.md` 与 `_aiprod/tools/delivery_test_report/README.md`。

## 目录边界

- `resources/api_contracts/`：工具拥有的原始 OpenAPI、维护版、接口目录与 registry；不写测试范围、测试断言或报告。
- `resources/api_test_scenarios-pw/`：跨范围复用的测试资产、Fixture 与 Knowledge；最终断言留在测试范围。
- `work/testing/{id}/testing-pw/`：独立测试的已审核用例、Spec、测试报告与 Test Run。
- `changes/`：本测试工作区不使用。所有测试都在 `work/testing/{id}/` 下创建和维护，不创建 Product Change、`change.md`、`requirements/`、`release/` 或 `changes/{id}/testing-pw/`。
- `work/` 在本工作区只使用 `work/testing/` 和 `work/document_sync/`；`user_requests/`、`tasks/`、`agent_runs/`、`artifacts/` 等完整产品工作区目录不适用，不得创建。
- `references/` 只维护测试环境的外部集成配置和本地密钥示例；`resources/` 只维护 API Contract 与 Playwright 公共测试资产。两个目录的公共 README 中超出上述范围的产品资产类型不适用。
- `.aiprod-local/`：原生 HTML/JSON 报告、Trace、日志和临时 simulation 产物；不提交 Git。

## 强制规则

- 正式 Spec 必须来自已审核用例；先运行资产检查和 `playwright_test_run --list`，再运行真实测试。
- 公共 Action 的直接 Contract 必须处于当前 `active + verified + L2` 且指纹一致。
- 运行器、浏览器、权限、账号或环境故障必须记录为 `blocked`；不得用 `skip`、`fixme`、弱化断言或 API 替代 UI 行为伪造通过。
- 真实运行、BUG 和复测使用现有 `delivery_test_report`；本工作区统一传入 `--testing-dir work/testing/{id}`，不使用 `--change`。

## 框架更新边界

- `AGENTS.md` 与 `_aiprod/` 是测试框架拥有内容，`update` 可以覆盖刷新。
- `references/integrations/integrations.json` 仅补齐缺失的框架示例与兼容迁移，保留已有真实集成配置；`secrets.local.json` 从不由框架创建、读取或覆盖。
- Playwright 配置、Support、Knowledge、Contract 和测试范围中的既有内容由测试工作区拥有；`update` 只在缺失时补齐默认文件，不得覆盖已有测试资产、已审核用例、Spec、报告或真实 Contract。
