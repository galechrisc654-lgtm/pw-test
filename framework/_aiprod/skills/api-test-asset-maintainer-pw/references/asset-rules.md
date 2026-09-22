# Playwright 公共资产规则

## 分层和元数据

公共业务资产是 Action、Flow、Page 和 Component，必须导出名为 `aiprod` 的字面量对象及稳定 `id`、`title`。Action 在 `contracts` 中声明直接调用的每个 `{ service, operationId, fingerprint, requestProfile? }`；Flow 只声明自身绕过 Action 直接请求的接口。Profile、`internal/`、Shared Data、Utils 和 Fixture 是从属或运行支持模块，不进入公共资产索引，也不导出 `aiprod`。

目录按“资产类型 → 业务域”组织：Action 使用 `actions/{domain}/{action-id}.ts`，Flow 使用 `flows/{domain}/{flow-id}/`，Page 使用 `pages/{domain}/{page-id}.ts`，Component 使用 `components/{domain-or-common}/{component-id}.ts`。完整示例和各支持目录见产品工作区 `resources/api_test_scenarios-pw/README.md`。该结构由维护规则约束，不由检查工具强制拦截；发现历史布局时在维护相关资产时整理，不为无关任务批量迁移。

## 资产说明沉淀

说明按需沉淀，不要求每个资产目录都有 README。单一 Action、简单 Flow、Page 和 Component 默认通过静态 `aiprod` 元数据、公开输入输出类型及必要代码注释说明职责、使用方式和关键限制。

当公开资产存在多个输入参数且组合会产生不同效果、可选 Profile 或阶段、特殊前置条件、副作用、清理/幂等/并发约束、复杂对象关系或返回语义，且调用者仅看公开接口仍可能误用时，按需添加 README。Flow 的 README 放在该 Flow 目录；单文件 Action、Page、Component 的 README 与源码同名并使用 `.README.md` 后缀。README 只说明用途、公开输入输出及其效果、阶段或 Profile、关键运行约束和调用范围；不得复制实现代码、Contract 登记表、最终断言、凭据或运行结果。

README 是面向调用者的辅助资料，检查工具不把它作为公共资产成立或通过检查的前置条件；代码注释仍只服务实现维护。没有上述使用层面的信息时，不为形式创建 README。

## Action

Action 放在 `actions/{domain}/` 中，是“明确参数 → 最小稳定业务动作 → 稳定业务结果”的普通异步函数。它可以调用多个 operation 并查询动作结果，但不读取 Flow Profile，不包含多阶段准备、测试专属数据或最终验收断言。HTTP 与业务成功都必须判定，长整型 ID 使用字符串。

## Flow、Profile 和内部实现

每个 Flow 使用 `flows/{domain}/{flow-id}/flow.ts` 作为唯一公共入口，用 Action 把系统准备到明确、可核验且将被测试消费的状态。固定流程骨架可用 `targetStage` 按顺序停止；拓扑、对象关系或数量语义不同则拆分。返回按业务对象组织并包含 `reachedStage`；未到阶段的集合为空、单对象为 `null`。

同目录 `profiles.json` 只保存当前 Flow 可命名、可选择的纯数据基线，不保存目标阶段、数量或条件开关。Flow 先深拷贝并归一化实例，再叠加本次参数与 `override`。多实例不得共享并修改同一请求对象。

复杂实现可拆到同目录 `internal/`；这些模块只能由当前 Flow 使用，不导出 `aiprod`，不作为独立 Flow 或公共调用入口。简单逻辑直接保留在 `flow.ts`。Flow 不引用 `testing-pw/` 中的私有测试，不承载最终验收断言。

写操作不得无条件并行；只有数据完全隔离、业务顺序无依赖且调用方明确允许时才并发。

## Page 和 Component

Page 放在 `pages/{domain}/` 中，代表一个业务页面或稳定页面区域，集中封装定位器、导航和页面操作。Component 放在 `components/{domain-or-common}/` 中，只封装被多个 Page 真实复用的独立复杂控件。两者优先使用面向用户的定位器，不保存测试数据或测试专属最终断言；页面独有控件留在对应 Page，不为潜在复用提前创建 Component。

## Playwright Fixture

`support/test.ts` 是使用 AIProd Fixture 的 Spec 统一入口，至少提供已解析的 `environment`，并从此导出 `test`、`expect`。产品按重复需求增加认证、API 客户端和 Page Object 等自定义 Fixture；数量较多时可拆到 `support/fixtures/` 再由 `support/test.ts` 组合。Fixture 默认使用 test scope，只在数据与账号可隔离时使用 worker scope。

Fixture 负责依赖和 setup/teardown，不把有业务副作用的重型 Flow 设置为自动 Fixture。它可以提供 Action Client、Page Object 或 Flow 调用能力，具体 Flow 仍由 Spec 显式调用。使用自定义 Fixture 的 Spec 从 `support/test.ts` 导入 `test`、`expect`。

## Knowledge

Knowledge 放在 `knowledge/{domain-or-topic}.md`，只记录已验证、跨测试复用且无法由 Contract、产品事实或可执行资产充分表达的经验。稳定定位器、导航和页面操作必须实现在 Page 或 Component；Knowledge 记录其选择依据、适用环境、复杂控件行为、可靠等待信号、权限差异、诊断结论和失效边界，并引用相关资产、产品源码或报告的仓库相对路径。格式与收录门槛直接遵循产品工作区 `knowledge/README.md`。

一次失败猜测、用例专属步骤与断言、完整代码实现、临时状态和敏感认证资料不得进入 Knowledge。经验能够稳定代码化时提升为对应公共资产，Knowledge 只保留仍有复用价值的背景和关系。

## Shared Data 和 Utils

Shared Data 使用 UTF-8 JSON，路径为 `shared-data/{domain}/{entity-type}.json`。一个文件只维护一种实体类型，顶层固定包含 `schemaVersion: 1`、单数 `entityType` 和 `records`；`records` 使用稳定的 kebab-case 别名映射到业务字段对象，业务长整型 ID 使用字符串。

Shared Data 只保存跨多个 Flow 使用、在各目标环境中具有相同业务身份且不会被测试改变的既存业务实体。调用者按别名选择记录并深拷贝后使用，不修改导入对象。文件不导出 `aiprod`，也不进入公共资产索引。

账号、密码、Token、Cookie、环境地址、租户及环境相关 ID 由 Integration 和本地 Secret 维护；订单、波次、拣货单、包裹等运行态对象由 Flow 创建；某个 Flow 的请求基线属于其 Profile；状态枚举和接口数据字典以产品事实或 API Contract 为准。这些内容均不得写入 Shared Data。Utils 只做无业务语义的纯计算或转换。

所有模块顶层均不得产生网络或外部状态副作用。认证状态和测试运行附件只存在 `.aiprod-local/`。
