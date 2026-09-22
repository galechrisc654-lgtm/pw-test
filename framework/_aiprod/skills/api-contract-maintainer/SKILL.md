---
name: api-contract-maintainer
description: 获取、校准和持续维护独立的 OpenAPI 接口契约，识别接口变化并维护逐接口可信状态。用户提到生成或更新 API 文档、校准 OpenAPI、接口契约、接口可信状态、接口变化识别或准备接口资料时使用。不维护测试 Action，不判断实现是否符合需求，不执行 API 测试，不修改业务代码。
---

# API Contract Maintainer

## 目标

把服务端生成的 OpenAPI 保存为不可改写的原始证据，经 Agent 按本次目标接口集合校准后，形成可供测试和其他消费者独立使用的标准 OpenAPI，并持续维护每个接口的契约验证状态、验证等级和必要的具名请求格式。维护结果累计在全量契约中。

## 必须读取

- `_aiprod/skills/api-contract-maintainer/references/artifact-format.md`
- `_aiprod/skills/api-contract-maintainer/references/verification-rules.md`
- `_aiprod/tools/openapi_fetcher/README.md`
- `_aiprod/tools/api_contract_registry/README.md`
- `_aiprod/tools/openapi_document_builder/README.md`

以上文件是本 Skill 的直接执行依赖，不得通过其中的链接继续寻找必要规则。

## 输入

- 默认配置 `resources/api_contracts/api-contracts.json`，或对话中提供的服务标识、环境标识和 OpenAPI URL；
- 本次目标：接口键、标签、Product Change、代码改动范围或用户描述的业务动作中的至少一种；
- 可选的多个相关代码源，包括接口提供方、前端或其他消费者、网关以及共享模型；
- 可选的每个代码仓库版本线索：Git commit SHA、可解析到 commit 的发布标签或构建版本、分支名与部署时间，或只有部署时间；
- 可选的非生产环境运行时观察条件。

代码版本线索不是获取 OpenAPI 的前提。未明确提供其他版本线索时，校准代码默认以每个相关仓库的 `dev` 分支为起点：先只读确认 `dev` 引用和 commit，再使用该次提交完成后形成的代码快照检索代码；当前工作树不在该快照时不得静默改用当前分支。`code_roots[].commit` 定义 API 文档对应的固定代码版本快照；测试查代码和契约校准必须复用同一 `code_roots[].commit`，不能各自取最新 `dev`。省略时只有在 `dev` 已确认且工作树位于解析出的文档对应快照时才可采用当前工作树。用户提供版本线索时，必须按 `verification-rules.md` 为每个相关仓库独立解析，不得在固定 commit、`dev` 分支与当前工作树之间静默切换。

## 大文件处理

`openapi.raw.json`、`openapi.resolved.json`、`operations.json`、`registry.json`、`changes.json` 和 `index.md` 由工具全量解析或重建，但不把全文作为 Agent 输入。Agent 先使用工具返回的数量、哈希和变化摘要，再按接口键、operationId、标签或业务关键词检索目标记录；确定目标后，只读取对应 operation、递归 `$ref`、登记项和相关补丁。代码仓库同样先搜索再读取命中文件及必要上下文。

接口状态通过 `api_contract_registry` 按目标接口更新；文档补丁只维护本次确认的 JSON Pointer。工具可以重新生成全量派生文件，Agent 无需为此读取或复述其全文。

## 执行流程

### 1. 确认边界

优先读取 `resources/api_contracts/api-contracts.json`，列出其中已配置的服务、启用状态、环境、OpenAPI 地址来源和代码根目录，再根据用户指定的服务、接口或业务描述选择目标；不得把任何 `*.example.json` 当作实际配置执行。

逐项读取 `code_roots`。用户在当前请求中明确给出版本线索，或要求 Agent 判断并维护代码基准时，视为只授权更新对应项的 `commit`：先按 `verification-rules.md` 确定唯一的完整 SHA，只把该结果写入配置，验证配置仍为合法 JSON，再开始代码对比。标签、构建版本、分支、时间和解析过程只作为对话与执行证据，不写入配置。没有这类明确指令时只读取配置，不主动写入；不得改动无关代码源、服务、地址或认证配置。

正式配置不存在时，使用对话中提供的服务标识、环境和 OpenAPI URL 直接执行；只有用户要求长期保存配置时，才以示例为基础创建 `api-contracts.json`。对话中提供的临时值不得擅自写入配置。

明确服务、环境和本次目标接口集合。未指定目标时可以获取和登记全量文档，但不得默认对全量接口进行人工校准。

只在已授权的非生产环境读取接口文档或做运行时观察。不得把生产环境作为默认目标。

### 2. 获取全量原始文档

调用 `openapi_fetcher`。从产品级配置选择服务时，将该服务与默认项合并后通过工具参数执行；也可使用工具支持的单服务配置。配置采用通用 JSON，工具不得依赖特定产品地址、Product Change 或 AIProd 对象。若工作区已登记外部集成，可先用 `integration_resolver` 解析 URL，再通过命令参数传给获取工具；集成登记不是必需条件。

获取工具必须完成：HTTP 状态检查、JSON/OpenAPI 结构校验、全文档哈希、与上一版原始文档的逐接口差异计算。Agent 以工具输出的结构化摘要判断后续范围，不读取获取结果全文。语义内容未变化时保留原始快照文件，不重复改写。`changes.json` 只描述测试环境原始 OpenAPI 的变化，不作为维护版接口目录。

### 3. 合成当前维护版并同步登记表

调用 `openapi_document_builder`，按 `openapi.raw.json`、可选的 `openapi.supplement.json`、`overlays.json` 顺序合成 `openapi.resolved.json`，并从合成结果生成 `operations.json`。随后调用 `api_contract_registry sync`：新增或发生指纹变化的接口转为 `pending`；已验证且指纹未变的接口保留原状态；消失的接口标记为 `removed`。

`openapi.supplement.json` 与原始 OpenAPI 出现相同 method + path 时，构建器报告冲突。Agent 对照新原始文档和既有代码证据：服务端已经完整收录时移除对应补充项；只部分收录时把差异转为 `overlays.json` 修正，再重新构建。不得用补充内容静默覆盖服务端 operation。

### 4. 选择本次目标接口

来源按优先级组合：用户明确指定的接口或标签、当前需求涉及的业务描述、变化报告中的新增或变化接口、相关代码中暴露的接口。先检索 `operations.json`、`changes.json`、`index.md` 和代码，只读取匹配记录与必要上下文；接口名称只提供候选映射，仍需按 `verification-rules.md` 核对真实入口、处理链和业务对象写入闭环。合并并去重接口键后，只校准本次目标接口及其直接依赖的共享模型。

用户以业务动作提出目标时，先区分直接 CRUD、组合业务入口和统一网关或分发入口，并按 `verification-rules.md` 做最低限度的业务合理性检查。名称匹配的 operation 不能直接视为业务动作入口；若候选接口只完成主表、子步骤或明显缺少该动作的必要对象，继续反向搜索调用方、分发键和其他入口。存在多个合理入口且证据无法区分时，报告候选与差异，不静默选择。

本次目标接口集合是临时执行输入，不为每次需求创建长期 Scope 或 Manifest。选择和校准目标接口时直接使用全量维护文档、接口目录和相关代码。测试 Action、Fixture、测试断言和测试执行结果不属于 API Contract，由各自测试资产维护入口负责。

### 5. 校准契约

按每个 `code_roots` 项选择代码：存在用户明确指定的 `commit` 时只读该 Git 对象；否则先只读确认本地 `dev` 分支（必要时唯一远端跟踪 `dev` 引用）及其 commit，再从该版本读取代码。当前分支不是 `dev` 时使用 `git grep`、`git show` 等方式读取 `dev`，不得切换工作树；`dev` 不存在、候选不唯一或目标代码仅在其他分支可见时，报告版本缺口并暂停受影响判断。工作树模式仅在已确认 `dev` 且当前工作树就是该基准时适用，并记录当前分支、`HEAD` 和工作树是否有未提交改动。Agent 自行判断各仓库承担接口提供、调用、网关转换或共享类型中的什么角色，并搜索目标接口的相关实现；不得要求配置人员预先建立代码源与 API 服务的映射，也不得因后端路由已经匹配就跳过其他仓库。

OpenAPI 是否显式收录只决定发现起点，不改变可信标准。按 `verification-rules.md` 检查实际路由、输入与校验、处理映射、响应与横切协议，并在需要作排他性结论时搜索相近入口。检查深度随接口复杂度调整，以能解释如何构造有效请求和会收到什么为止；简单接口不必机械产生逐项材料，组合动作和统一分发接口则必须追到实际处理器。字段说明只能依据明确证据修正。

校准请求字段时，必须核对提供方实际消费字段、所有相关消费者调用路径实际发送字段和可用运行时观察；同一请求封装存在多个调用方时不得在首个命中后停止。按 `verification-rules.md` 解释字段是服务端消费、条件消费、消费者透传、框架或运行时补充，还是来源未明；未完成影响调用的字段归因时不得标记为 `verified`。

固定 commit 的读取必须保持仓库工作树和索引不变。不得为校准执行 `checkout`、`switch`、`reset`、`pull` 或其他改变当前仓库状态的操作；默认只使用本地已有对象和引用。需要获取远端缺失对象时，必须先说明缺口并取得用户授权。工作树模式只读取现状，不清理、暂存或修改用户代码。

不直接修改原始 OpenAPI 或业务代码。已收录 operation 的修正写入 `overlays.json`；代码能还原为有效 HTTP 契约而原始文档缺失的入口写入 `openapi.supplement.json`；统一分发路径按业务变体建模。弃用保留 operation 并标记 `deprecated`；只有证据表明当前已不可调用时才移除。实现文件存在、单次搜索未命中、前端未调用或文档未输出，都不能单独决定补充或移除。

### 6. 维护验证状态

只能调用 `api_contract_registry set` 更新状态：

- `verified`：当前指纹下，维护后的契约与可获得的契约证据一致；
- `pending`：尚未完成校准，或变更后等待重新校准；
- `blocked`：已尝试，但因访问、证据不足或歧义无法判定；必须写明原因；
- `conflict`：文档、运行时或代码契约证据相互矛盾，无法形成可信契约；必须写明冲突。

生命周期独立维护为 `active`、`deprecated` 或 `removed`。`blocked` 不表示实现存在缺陷；明显业务实现问题应交给产品实现核查流程。

验证状态表示当前校准流程结论，验证等级表示证据深度：`L0` 仅发现、`L1` 结构对齐、`L2` 已能确定可调用格式、`L3` 已有当前指纹下的真实运行证据。历史 `verified` 缺少等级时按 L2 兼容，不批量重验。需要数组、对象或其他特殊线格式时，在 operation 下维护具名 `request_profiles`；profile 独立记录等级、序列化和执行器适配，用例通过 `request_profile` 选择，不能按测试数据值全局推断。

测试执行与等级升级必须分离。`karate_test_run` 不得写入 registry；一次测试结束后，Agent 另行进入契约维护，核对 `run-metadata.json` 中的 Contract 快照、部署关联、当前 fingerprint、实际使用的 profile 和原生报告，再显式调用 `api_contract_registry set` 升级到 L3。业务断言通过不能自动证明另一个 profile，关联不一致、失败或证据不完整时不升级。

补充或修正契约后，先调用 `openapi_document_builder` 重新合成维护版并生成 `operations.json`，再调用 `api_contract_registry sync` 使新增和变化项回到 `pending`。然后用 `api_contract_registry set` 更新本次目标接口或业务变体的状态；最后以最新登记表再次构建，使 `openapi.resolved.json` 中的 `x-api-contract-verification` 与登记状态一致。构建成功、哈希和接口数量以工具摘要确认，无需读取生成文档全文。

### 7. 交接

报告获取结果、目标范围、变化数量、各状态数量、已应用补丁、无法闭环项及对应证据。对每个已检查仓库报告采用 `commit` 或 `working-tree` 模式；固定版本报告完整 SHA，工作树模式报告分支、`HEAD` 和是否存在未提交修改。对话版本线索还要报告解析方式、置信度，以及时间定位所用的分支与时区。明确区分：契约已验证、需求符合性、测试通过。后两者不由本 Skill 得出。

## 完成标准

- 原始快照、维护版、变化、接口目录和状态可追溯，且没有改写业务代码；
- 维护版是合法 OpenAPI 3.x，新增或变化项没有沿用旧的 `verified`；
- Agent 只按需读取目标接口、依赖模型和相关代码，大文件由工具处理；
- `verified + L2` 具有足以还原可调用契约的代码或运行时证据；L3 具有经 Agent 单独审阅的真实运行证据，无法闭环的项使用恰当状态；
- 补充、修正、弃用和移除写入正确资产，统一分发变体具有独立指纹与状态；
- 代码基准和无法定位的版本问题已说明，状态均由登记工具更新；
- 输出明确区分契约一致、需求符合和测试通过。
