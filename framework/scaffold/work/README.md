# work

`work/` 存放工作管理资料。

本目录用于管理：

- 原始诉求；
- Agent 可执行任务；
- Agent 执行记录。
- Agent 执行产物。

本目录不存放：

- 当前产品事实；
- 产品探索和产品改变主文档；
- 用户操作手册；
- 与执行边界无关的临时笔记；
- 本地密钥。

```text
work/
  user_requests/
  tasks/
  testing/
  agent_runs/
  artifacts/
  document_sync/
```

| 路径 | 说明 |
| --- | --- |
| `user_requests/` | 原始诉求，每个诉求一个目录。 |
| `tasks/` | Agent 可执行任务，每个任务一个 Markdown 文件。 |
| `testing/` | 不依赖 Product Change 的独立测试范围，每个范围一个目录。 |
| `agent_runs/` | Agent 执行记录，按月份使用 JSONL 追加记录。 |
| `artifacts/` | Agent 执行产物，用于存放不属于产品事实、产品探索、产品改变或用户文档，但需要保留、交接或作为外部发布来源的结果文档。 |
| `document_sync/` | 本地文档与飞书同步时的产品负责人规则和关联关系；新工作区会初始化规则、可覆盖更新的配置样例和空关联关系。 |

## user_requests

`work/user_requests/` 存放原始诉求及其轻量分析和产品负责人决策。

每个 `request.md` 在同一文件中分区维护原始诉求资料、诉求分析和产品负责人决策。原始诉求资料只保存来源方表达、资料引用和忠实摘要；分析判断和正式决策不得混入原始诉求资料。

原始诉求不是正式需求，不是方案设计，不是当前产品事实。

```text
work/user_requests/
  {user_request_id}/
    request.md
    attachments/
      {attachment_file}
```

`request.md` 中必须维护附件引用列表，用于引用本地原始文件、远程文件、项目内其他参考资料或不适合复制进仓库的大文件和敏感资料。

创建原始诉求时，必须先阅读对象定义：

```text
_aiprod/objects/user_request.md
```

## tasks

`work/tasks/` 存放 Agent 可执行任务。

Task 用于为需要正式管理的 Agent 工作定义执行边界。写入型产品工作不因写入本身强制创建或指定 Task；Product Owner 可以主动创建或指定 Task，指定后应按该 Task 执行。

每个 Task 使用一个 Markdown 文件：

```text
work/tasks/{task_id}.md
```

Task 对象规则见：

```text
_aiprod/objects/task.md
```

修改 Task 状态应使用框架工具：

```powershell
node .\_aiprod\runtime\aiprod-launcher.cjs run task_status_updater {task_id} {status} --project-root .
```

## agent_runs

`work/agent_runs/` 存放 Agent 执行记录。

执行记录用于记录 Agent 执行 Task 后的结构化摘要，不替代 Git diff，也不作为当前产品事实源。

记录文件按月份组织，使用 JSONL 追加写入：

```text
work/agent_runs/YYYY-MM.jsonl
```

Agent 不得手工编辑或追加 Agent Run JSONL。记录 Agent Run 必须使用框架工具：

```powershell
node .\_aiprod\runtime\aiprod-launcher.cjs run agent_run_logger --task {task_id} --summary "{summary}" --project-root .
```

Agent Run 对象规则见：

```text
_aiprod/objects/agent_run.md
```

## artifacts

`work/artifacts/` 存放 Agent 执行产物。

Agent不能直接编辑此文档。

## testing

`work/testing/{test_id}/` 用于不依赖 Product Change 的独立测试范围。`test-cases.md` 是业务用例源，`features/` 保存 Karate 编排，`test_data_sessions-ka/` 保存已核验的跨运行数据。调用 `delivery_test_report --testing-dir work/testing/{test_id}` 创建并维护 `test-report.md`、`test-runs.md`；调用 `karate_test_run --testing-dir work/testing/{test_id}` 执行测试并自动追加真实 Run。每次运行的原生报告、运行元数据和控制台日志保存到 `.aiprod-local/test-reports/karate/independent/{test_id}/`，不在工作区中创建单次运行 Markdown。目录由 Agent 在用户指定测试范围时创建。

独立 Playwright 测试使用 `work/testing/{test_id}/testing-pw/`，其中维护 `test-cases.md`、`tests/`、`test-report.md` 和 `test-runs.md`；报告命令增加 `--engine pw`，执行使用 `playwright_test_run --testing-dir work/testing/{test_id}`。KA 既有独立测试结构保持不变。
