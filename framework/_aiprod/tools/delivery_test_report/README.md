# Delivery Test Report

`delivery_test_report` 维护当前 BUG 列表和独立的 Test Run 汇总。它不处理历史报告迁移，也不覆盖已存在的报告。

工具范围必须二选一：`--change {change_id}` 或 `--testing-dir work/testing/{test_id}`。默认引擎为 KA，路径与既有命令不变；Playwright 命令增加 `--engine pw`，分别对应 `changes/{change_id}/testing-pw/` 或 `work/testing/{test_id}/testing-pw/`。两个引擎不共用报告。报告先写入上述本地目录，再按`交付测试报告同步`规则同步到配置的飞书固定父目录。

## 初始化报告

```powershell
node .\_aiprod\runtime\aiprod-launcher.cjs run delivery_test_report init `
  --change "PC-20260812-001" `
  --title "入库与库存功能测试报告" `
  --project-root .
```

独立测试使用：

```powershell
node .\_aiprod\runtime\aiprod-launcher.cjs run delivery_test_report init `
  --testing-dir "work/testing/TEST-20260812-001" `
  --title "库存功能回归测试报告" `
  --project-root .
```

工具会创建同级的 `test-report.md` 与 `test-runs.md`。`test-cases.md` 已存在时，必须先经用户明确同意并标记“审核状态：已审核”，初始化才会提取 `TC-xxx` 标题并建立 `not_run` 状态；已审核用例后续变化时调用 `sync-test-cases`，保留仍存在用例的当前状态、加入新用例并从当前状态表移除已删除用例。未审核文档会被 `init`、`sync-test-cases` 和 `summary` 拒绝。`test-report.md` 同时包含测试用例当前状态和 BUG 列表；使用 `update-test-case` 维护用例状态。省略 `--title` 时使用范围 ID 加“测试报告”。报告标题下仅在关联 Change 的 `requirements/prd.md` 已有飞书关联时写入“飞书文档：{URL}”；没有关联则不显示任何测试依据内容。

仅做代码核查并首次初始化统一报告时，给 `init` 增加 `--code-review`。此模式下，已审核 `test-cases.md` 仍会正常初始化用例状态；不存在用例或用例仍待审核时先创建空用例状态表，使代码核查 BUG 可以写入，但不会读取、修改或认可待审核用例。后续用例审核通过后调用 `sync-test-cases` 纳入同一报告。功能测试初始化不得使用该参数绕过审核；Karate 执行、`sync-test-cases` 和 `summary` 的审核门禁不变。

```powershell
node .\_aiprod\runtime\aiprod-launcher.cjs run delivery_test_report init `
  --change "PC-20260812-001" `
  --code-review `
  --title "入库与库存测试报告" `
  --project-root .
```

## 用例同步与紧凑查询

```powershell
node .\_aiprod\runtime\aiprod-launcher.cjs run delivery_test_report sync-test-cases --change "PC-20260812-001" --project-root .
node .\_aiprod\runtime\aiprod-launcher.cjs run delivery_test_report summary --change "PC-20260812-001" --project-root .
node .\_aiprod\runtime\aiprod-launcher.cjs run delivery_test_report list-test-runs --change "PC-20260812-001" --limit 5 --project-root .
```

`summary` 只返回用例状态数量、缺失/额外/未完成 ID、BUG 状态数量、Run 总数和 `complete`，用于判断下一批和流程结束，不把 Markdown 全文载入 Agent 上下文。`list-test-runs` 默认返回最近 5 条，可用 `--limit 1..50` 或 `--run-id` 定位；不得为了查看最近执行而全文读取 `test-runs.md`。

测试用例状态示例：

```powershell
node .\_aiprod\runtime\aiprod-launcher.cjs run delivery_test_report update-test-case `
  --testing-dir "work/testing/TEST-20260903-001" `
  --case "TC-007" `
  --name "创建库存单" `
  --status "failed" `
  --latest-run "TR-20260903-001" `
  --remark "返回 HTTP 500。" `
  --project-root .
```

独立测试如涉及多个 Change，初始化时重复传入 `--basis-change`：

```powershell
node .\_aiprod\runtime\aiprod-launcher.cjs run delivery_test_report init `
  --testing-dir "work/testing/TEST-20260812-001" `
  --basis-change "PC-20260812-001" `
  --basis-change "PC-20260820-002" `
  --project-root .
```

如果 PRD 的飞书关联在报告创建后才建立，在同步报告前调用以下命令刷新报告顶部链接：

```powershell
node .\_aiprod\runtime\aiprod-launcher.cjs run delivery_test_report refresh-basis `
  --change "PC-20260812-001" `
  --project-root .
```

## 自动测试后的 Test Run 与 BUG

真实 Change 或独立测试必须向 `karate_test_run` 传入 `--scope`，由执行工具在生成 HTML 报告后自动、幂等地追加运行。只有执行工具返回 `recording.status: failed`，或需要修复一条已有原生报告但尚未登记的 Run 时，才调用 `append-test-run`。工具校验 Run ID、结果、报告存在性、报告范围和 `karate-summary.html` 文件名；同 ID 同内容视为已登记，同 ID 不同内容拒绝写入。

Playwright 的处理规则相同，但所有报告命令增加 `--engine pw`，执行工具为 `playwright_test_run`，Run ID 使用 `TR-PW-*`，报告首页为对应运行目录的 `raw/html/index.html`。

```powershell
node .\_aiprod\runtime\aiprod-launcher.cjs run delivery_test_report append-test-run `
  --change "PC-20260812-001" `
  --run-id "TR-KA-20260831-002" `
  --scope "TC-003 复测" `
  --result "passed" `
  --report ".aiprod-local/test-reports/karate/changes/PC-20260812-001/runs/TR-KA-20260831-002/raw/karate-summary.html" `
  --project-root .

node .\_aiprod\runtime\aiprod-launcher.cjs run delivery_test_report add-bug `
  --change "PC-20260812-001" `
  --type "功能测试" `
  --description "保存操作预期成功创建记录；实际接口返回 HTTP 500，未产生可用记录，导致目标功能无法完成。" `
  --system-record "SO-20260831-0008；sku=SKU-001；warehouse=WH-003" `
  --framework-evidence "Test Run：TR-KA-20260831-002；测试用例：TC-003" `
  --project-root .

node .\_aiprod\runtime\aiprod-launcher.cjs run delivery_test_report add-bug `
  --change "PC-20260812-001" `
  --type "代码核查" `
  --description "预期提交后更新单据状态；实际 src/modules/order/service.ts:128 未执行状态更新，导致后续流程无法识别完成状态。" `
  --framework-evidence "代码核查，2026-08-31" `
  --project-root .
```

BUG 类型只能为 `代码核查` 或 `功能测试`。`问题说明`必须写清预期、实际结果和业务影响；问题涉及代码时，还必须在对应实现描述中直接引用源码 Git 仓库根目录相对路径，建议带行号，例如 `src/modules/order/service.ts:128`。`系统单据`只填写可在业务系统中查验的单据或数据标识；`框架内依据`填写 Test Run、测试用例/场景、核查日期或关键参数等框架内依据。功能测试建议将可复现的业务单据或数据 ID 写入`系统单据`，将 Test Run、测试用例或关键参数写入`框架内依据`。`代码核查`类型的新增问题会由工具检查`问题说明`中的相对代码路径并拒绝绝对路径；更新其`问题说明`时执行相同检查。

工具只新增 `BUG-001`、`BUG-002` 等稳定编号，不删除、重排或复用。自动新增的 BUG 状态为 `待审核`，由产品负责人审核后决定进入修复或不处理。

## 经产品负责人核对后更新 BUG

```powershell
node .\_aiprod\runtime\aiprod-launcher.cjs run delivery_test_report update-bug `
  --change "PC-20260812-001" `
  --bug "BUG-001" `
  --status "待复测" `
  --latest-verification "开发已部署修复，等待 TR-KA-20260831-003 复测" `
  --project-root .
```

状态按固定流程流转：`待审核 → 待修复 → 待复测 → 已通过 → 已关闭`，或 `待审核 → 不处理`。仅产品负责人可决定审核、发起复测和关闭；`已通过`也必须经产品负责人确认后才能关闭。`update-bug` 支持 `--description`、`--system-record`、`--framework-evidence`、`--remark` 与 `--latest-verification`，用于按产品负责人要求补充记录。

开发修复后，产品负责人将 BUG 标记为 `待复测`。自动化测试仅复测该状态的 BUG，并使用 `record-retest` 自动回写结果：通过改为 `已通过`，不通过改回 `待修复`并把失败详情追加到备注。

```powershell
node .\_aiprod\runtime\aiprod-launcher.cjs run delivery_test_report record-retest `
  --change "PC-20260812-001" `
  --bug "BUG-001" `
  --run-id "TR-KA-20260831-003" `
  --result "passed" `
  --details "TC-003 复测通过，记录已成功创建。" `
  --project-root .
```

发现与未关闭（`待审核`、`待修复`、`待复测`、`已通过`）问题相同的现象时，不新建 BUG，应更新原 BUG 的说明、系统单据、框架内依据或备注；`不处理`的问题无需复测或新增。已关闭问题复发才新增 BUG，并带上 `--related-bug "BUG-001"` 关联原记录。

`update-test-case` 只允许 `not_run`、`passed`、`failed`、`blocked`、`skipped`、`not_api_testable`。`passed/failed` 必须提供 `--latest-run`；`blocked/skipped/not_api_testable` 必须提供 `--remark`。`test-runs.md` 只追加，不修改历史 Run。写入操作支持 `--dry-run`。
