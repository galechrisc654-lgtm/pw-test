"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.missingOnlyScaffoldFiles = exports.refreshScaffoldFiles = void 0;
exports.mergeIntegrationsJson = mergeIntegrationsJson;
exports.updateProject = updateProject;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const fs_1 = require("./fs");
const frameworkFiles_1 = require("./frameworkFiles");
const launcher_1 = require("./launcher");
const paths_1 = require("./paths");
const projectIgnore_1 = require("./projectIgnore");
const codexAgents_1 = require("./codexAgents");
const safeDirs = [
    "specs/data",
    "specs/features",
    "specs/flows",
    "specs/integrations",
    "specs/outputs",
    "specs/patterns",
    "specs/rules",
    "specs/history",
    "discoveries",
    "changes",
    "work/tasks",
    "work/testing",
    "work/user_requests",
    "work/agent_runs",
    "work/artifacts",
    "work/document_sync",
    "references/integrations",
    "resources/api_contracts",
    "resources/api_test_scenarios-ka/config",
    "resources/api_test_scenarios-pw/config",
    "resources/api_test_scenarios-pw/support",
    "demos",
    "docs",
];
exports.refreshScaffoldFiles = [
    "AGENTS.md",
    "README.md",
    "specs/README.md",
    "specs/index.md",
    "discoveries/README.md",
    "changes/README.md",
    "work/README.md",
    "references/README.md",
    "resources/README.md",
    "demos/README.md",
    "docs/README.md",
    "work/document_sync/sync_rules.example.yaml",
    "references/integrations/secrets.local.example.json",
    "resources/api_contracts/api-contracts.example.json",
];
exports.missingOnlyScaffoldFiles = [
    "specs/overview.md",
    "specs/glossary.md",
    "work/document_sync/sync_rules.yaml",
    "work/document_sync/relations.json",
    "resources/api_test_scenarios-pw/README.md",
    "resources/api_test_scenarios-pw/knowledge/README.md",
    "resources/api_test_scenarios-ka/config/karate-config.js",
    "resources/api_test_scenarios-pw/config/playwright.config.ts",
    "resources/api_test_scenarios-pw/support/assets.ts",
    "resources/api_test_scenarios-pw/support/test.ts",
];
const deprecatedFrameworkFiles = [
    "_aiprod/adapters/codex/agents/aiprod_test_case_producer.toml",
    "_aiprod/adapters/codex/agents/aiprod_test_case_reviewer.toml",
    "_aiprod/tools/integration_resolver/resolve_integration.py",
    "_aiprod/tools/task_status_updater/update_task_status.py",
    "_aiprod/adapters/feishu-cli/ADAPTER.md",
    "_aiprod/objects/development_handoff.md",
    "_aiprod/objects/product_spec_update_record.md",
    "_aiprod/objects/requirement.md",
    "_aiprod/objects/requirement_research.md",
    "_aiprod/objects/requirement_solution.md",
    "_aiprod/objects/solution.md",
    "_aiprod/skills/requirement-release-acceptance/SKILL.md",
    "_aiprod/skills/product-spec-requirement-sync/SKILL.md",
    "_aiprod/skills/product-spec-requirement-sync/references/output_templates.md",
    "_aiprod/skills/test-case-designer/references/api-execution-binding.md",
    "_aiprod/adapters/apifox-cli/ADAPTER.md",
    "_aiprod/adapters/apifox-mcp/ADAPTER.md",
    "_aiprod/mcps/apifox/MCP.md",
    "_aiprod/routines/api-testing/ROUTINE.md",
    "_aiprod/skills/api-test-executor/SKILL.md",
    "_aiprod/skills/api-test-scenario-designer/SKILL.md",
    "_aiprod/skills/api-test-scenario-designer/references/api-test-specification.md",
    "_aiprod/skills/api-test-scenario-designer/references/test-data-scenarios.md",
    "_aiprod/skills/api-test-scenario-designer/references/verification-strategy.md",
    "_aiprod/skills/test-data-provisioning/SKILL.md",
    "_aiprod/skills/test-data-provisioning/references/fixed-scenario-format.md",
    "_aiprod/skills/test-data-provisioning/references/workflow-format.md",
    "_aiprod/tools/apifox_contract_sync/README.md",
    "_aiprod/tools/apifox_project_sync/README.md",
    "_aiprod/tools/apifox_test_case_cleanup/README.md",
    "_aiprod/tools/apifox_test_sync/README.md",
    "_aiprod/tools/apifox_test_verify/README.md",
    "_aiprod/tools/api_test_run/README.md",
    "_aiprod/tools/api_test_validate/README.md",
    "_aiprod/tools/api_test_variable_register/README.md",
    "_aiprod/tools/test_data_prepare/README.md",
    "_aiprod/tools/test_data_session/README.md",
    "_aiprod/tools/test_run_recorder/README.md",
    "_aiprod/objects/test_plan.md",
    "_aiprod/objects/test_run.md",
    "_aiprod/objects/defect_summary.md",
    "_aiprod/skills/api-test-scenario-designer-ka/SKILL.md",
    "_aiprod/skills/test-data-provisioning-ka/SKILL.md",
    "_aiprod/skills/api-test-harness-maintainer-ka/SKILL.md",
    "_aiprod/skills/api-test-harness-maintainer-ka/references/asset-rules.md",
    "_aiprod/skills/api-test-harness-maintainer-ka/assets/action.feature",
    "_aiprod/skills/api-test-harness-maintainer-ka/assets/fixture.feature",
    "_aiprod/tools/karate_harness_check/README.md",
    "_aiprod/skills/database-readonly-query/SKILL.md",
    "_aiprod/skills/database-readonly-query/references/usql.md",
];
function pushUnique(target, value) {
    if (!target.includes(value)) {
        target.push(value);
    }
}
function addAction(report, projectRoot, action) {
    const relative = node_path_1.default.relative(projectRoot, action.path) || ".";
    if (action.action === "created")
        pushUnique(report.created, relative);
    if (action.action === "updated")
        pushUnique(report.updated, relative);
    if (action.action === "new_file")
        pushUnique(report.new_files, relative);
    if (action.action === "skipped")
        pushUnique(report.skipped, relative);
}
function removeLegacyGeneratedLaunchers(projectRoot, report) {
    const legacyLaunchers = [
        {
            relativePath: "aiprod.cmd",
            markers: ["_aiprod\\runtime\\aiprod-launcher.cjs", "%*"],
        },
        {
            relativePath: "aiprod.ps1",
            markers: ["_aiprod/runtime/aiprod-launcher.cjs", "@args"],
        },
        {
            relativePath: "aiprod",
            markers: ["_aiprod/runtime/aiprod-launcher.cjs", '"$@"'],
        },
    ];
    for (const item of legacyLaunchers) {
        const fullPath = node_path_1.default.join(projectRoot, item.relativePath);
        if (!node_fs_1.default.existsSync(fullPath) || !node_fs_1.default.statSync(fullPath).isFile())
            continue;
        const content = (0, fs_1.readText)(fullPath);
        if (!item.markers.every((marker) => content.includes(marker))) {
            report.manual_actions.push(`${item.relativePath} looks like a custom file; review whether it should remain in the product project root.`);
            continue;
        }
        node_fs_1.default.unlinkSync(fullPath);
        pushUnique(report.deprecated, item.relativePath);
    }
}
function removeDeprecatedGeneratedFiles(projectRoot, report) {
    for (const relativeFile of ["resources/api_contracts/api-action-catalog.example.json"]) {
        const fullPath = node_path_1.default.join(projectRoot, relativeFile);
        if (!node_fs_1.default.existsSync(fullPath) || !node_fs_1.default.statSync(fullPath).isFile())
            continue;
        node_fs_1.default.unlinkSync(fullPath);
        pushUnique(report.deprecated, relativeFile);
    }
}
function isRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function mergeMissing(base, additions) {
    if (!isRecord(base) || !isRecord(additions)) {
        return { value: base, changed: false };
    }
    let changed = false;
    const result = { ...base };
    for (const [key, addition] of Object.entries(additions)) {
        if (!(key in result)) {
            result[key] = addition;
            changed = true;
            continue;
        }
        const merged = mergeMissing(result[key], addition);
        if (merged.changed) {
            result[key] = merged.value;
            changed = true;
        }
    }
    return { value: result, changed };
}
function migrateLegacyFeishuCliIntegration(value) {
    if (!isRecord(value)) {
        return { value, changed: false };
    }
    const integrations = isRecord(value.integrations) ? value.integrations : {};
    const legacyFeishuCli = isRecord(integrations.feishu_cli) ? integrations.feishu_cli : null;
    if (!legacyFeishuCli || (legacyFeishuCli.adapter !== "feishu-cli" && legacyFeishuCli.adapter !== "lark-cli")) {
        return { value, changed: false };
    }
    const nextParams = isRecord(legacyFeishuCli.params) ? { ...legacyFeishuCli.params } : {};
    if (nextParams.executable_path === "${local:FEISHU_CLI_PATH}" || nextParams.executable_path === "${secret:FEISHU_CLI_PATH}") {
        nextParams.executable_path = "${local:LARK_CLI_PATH}";
    }
    if (nextParams.profile === "${local:FEISHU_CLI_PROFILE}" || nextParams.profile === "${secret:FEISHU_CLI_PROFILE}") {
        nextParams.profile = "${local:LARK_CLI_PROFILE}";
    }
    if (nextParams.brand === "feishu") {
        delete nextParams.brand;
    }
    const remainingIntegrations = { ...integrations };
    delete remainingIntegrations.feishu_cli;
    return {
        value: {
            ...value,
            integrations: {
                ...remainingIntegrations,
                lark_cli: {
                    ...legacyFeishuCli,
                    adapter: "lark-cli",
                    params: nextParams,
                },
            },
        },
        changed: true,
    };
}
function removeDeprecatedExampleApifoxIntegration(value) {
    if (!isRecord(value) || !isRecord(value.integrations))
        return { value, changed: false };
    const example = value.integrations.example_apifox;
    if (!isRecord(example) || example.adapter !== "apifox-cli")
        return { value, changed: false };
    const integrations = { ...value.integrations };
    delete integrations.example_apifox;
    return { value: { ...value, integrations }, changed: true };
}
function migrateLegacyUsqlAccess(value) {
    if (!isRecord(value) || !isRecord(value.integrations))
        return { value, changed: false };
    let changed = false;
    const integrations = { ...value.integrations };
    for (const [id, rawIntegration] of Object.entries(integrations)) {
        if (!isRecord(rawIntegration) || rawIntegration.adapter !== "usql" || !isRecord(rawIntegration.params))
            continue;
        if (!("readonly_required" in rawIntegration.params))
            continue;
        const params = { ...rawIntegration.params };
        if (params.access !== "readonly" && params.access !== "read_write")
            params.access = "readonly";
        delete params.readonly_required;
        integrations[id] = { ...rawIntegration, params };
        changed = true;
    }
    return changed ? { value: { ...value, integrations }, changed: true } : { value, changed: false };
}
function migratePlaywrightSharedRuntime(value) {
    if (!isRecord(value) || !isRecord(value.integrations))
        return { value, changed: false };
    let changed = false;
    const integrations = { ...value.integrations };
    for (const [id, rawIntegration] of Object.entries(integrations)) {
        if (!isRecord(rawIntegration) || rawIntegration.adapter !== "playwright-cli-pw" || !isRecord(rawIntegration.params))
            continue;
        if (!("node_path" in rawIntegration.params) && !("playwright_cli" in rawIntegration.params))
            continue;
        const params = { ...rawIntegration.params };
        delete params.node_path;
        delete params.playwright_cli;
        integrations[id] = { ...rawIntegration, params };
        changed = true;
    }
    return changed ? { value: { ...value, integrations }, changed: true } : { value, changed: false };
}
function mergeIntegrationsJson(projectRoot) {
    const targetFile = node_path_1.default.join(projectRoot, "references", "integrations", "integrations.json");
    const sourceFile = node_path_1.default.join((0, paths_1.scaffoldDir)(), "references", "integrations", "integrations.json");
    if (!node_fs_1.default.existsSync(targetFile)) {
        return (0, fs_1.writeManagedFile)(targetFile, (0, fs_1.readText)(sourceFile), "overwrite");
    }
    const target = (0, fs_1.readJson)(targetFile, true);
    const source = (0, fs_1.readJson)(sourceFile, true);
    const merged = mergeMissing(target, source);
    const migrated = migrateLegacyFeishuCliIntegration(merged.value);
    const removed = removeDeprecatedExampleApifoxIntegration(migrated.value);
    const usqlMigrated = migrateLegacyUsqlAccess(removed.value);
    const playwrightMigrated = migratePlaywrightSharedRuntime(usqlMigrated.value);
    if (!merged.changed && !migrated.changed && !removed.changed && !usqlMigrated.changed && !playwrightMigrated.changed) {
        return { action: "skipped", path: targetFile };
    }
    (0, fs_1.writeText)(targetFile, `${JSON.stringify(playwrightMigrated.value, null, 2)}\n`);
    return { action: "updated", path: targetFile };
}
function refreshProjectConfig(projectRoot) {
    const targetFile = node_path_1.default.join(projectRoot, "aiprod.config.yaml");
    const sourceFile = node_path_1.default.join((0, paths_1.scaffoldDir)(), "aiprod.config.yaml");
    const source = (0, fs_1.readText)(sourceFile).replaceAll("{{FRAMEWORK_VERSION}}", (0, fs_1.readText)((0, paths_1.frameworkVersionPath)()).trim());
    if (!node_fs_1.default.existsSync(targetFile)) {
        return (0, fs_1.writeManagedFile)(targetFile, source, "overwrite");
    }
    const existing = (0, fs_1.readText)(targetFile);
    const frameworkVersion = (0, fs_1.readText)((0, paths_1.frameworkVersionPath)()).trim();
    const updated = /^framework_version\s*:\s*.*$/m.test(existing)
        ? existing.replace(/^framework_version\s*:\s*.*$/m, `framework_version: ${frameworkVersion}`)
        : `${existing.trimEnd()}\nframework_version: ${frameworkVersion}\n`;
    if (updated === existing) {
        return { action: "skipped", path: targetFile };
    }
    (0, fs_1.writeText)(targetFile, updated);
    return { action: "updated", path: targetFile };
}
function updateProject(projectRoot) {
    (0, fs_1.ensureDir)(projectRoot);
    const report = {
        ok: true,
        project: projectRoot,
        updated: [],
        created: [],
        existing: [],
        new_files: [],
        skipped: [],
        manual_actions: [],
        deprecated: [],
        unexpected_framework_files: [],
    };
    for (const dir of safeDirs) {
        const fullPath = node_path_1.default.join(projectRoot, dir);
        if (!node_fs_1.default.existsSync(fullPath)) {
            (0, fs_1.ensureDir)(fullPath);
            pushUnique(report.created, dir);
        }
        else {
            pushUnique(report.existing, dir);
        }
    }
    for (const action of (0, frameworkFiles_1.copyFrameworkPayload)(projectRoot, "overwrite")) {
        addAction(report, projectRoot, action);
    }
    for (const action of (0, launcher_1.installProjectRuntime)(projectRoot)) {
        addAction(report, projectRoot, action);
    }
    removeLegacyGeneratedLaunchers(projectRoot, report);
    removeDeprecatedGeneratedFiles(projectRoot, report);
    for (const relativeFile of deprecatedFrameworkFiles) {
        const fullPath = node_path_1.default.join(projectRoot, relativeFile);
        if (node_fs_1.default.existsSync(fullPath) && node_fs_1.default.statSync(fullPath).isFile()) {
            node_fs_1.default.unlinkSync(fullPath);
            report.deprecated.push(relativeFile);
        }
    }
    const duplicateAgentDir = node_path_1.default.join(projectRoot, "_aiprod/adapters/codex/agents");
    if (node_fs_1.default.existsSync(duplicateAgentDir) && node_fs_1.default.lstatSync(duplicateAgentDir).isDirectory()
        && node_fs_1.default.readdirSync(duplicateAgentDir).length === 0) {
        node_fs_1.default.rmdirSync(duplicateAgentDir);
    }
    for (const sourceFile of exports.refreshScaffoldFiles) {
        const content = (0, fs_1.readText)(node_path_1.default.join((0, paths_1.scaffoldDir)(), sourceFile)).replaceAll("{{FRAMEWORK_VERSION}}", (0, fs_1.readText)((0, paths_1.frameworkVersionPath)()).trim());
        addAction(report, projectRoot, (0, fs_1.writeManagedFile)(node_path_1.default.join(projectRoot, sourceFile), content, "overwrite"));
    }
    addAction(report, projectRoot, refreshProjectConfig(projectRoot));
    for (const sourceFile of exports.missingOnlyScaffoldFiles) {
        const content = (0, fs_1.readText)(node_path_1.default.join((0, paths_1.scaffoldDir)(), sourceFile)).replaceAll("{{FRAMEWORK_VERSION}}", (0, fs_1.readText)((0, paths_1.frameworkVersionPath)()).trim());
        addAction(report, projectRoot, (0, fs_1.writeManagedFile)(node_path_1.default.join(projectRoot, sourceFile), content, "skip"));
    }
    const legacyApiContracts = node_path_1.default.join(projectRoot, "references", "engineering", "api_contracts");
    const resourceApiContracts = node_path_1.default.join(projectRoot, "resources", "api_contracts");
    if (node_fs_1.default.existsSync(legacyApiContracts) && !node_fs_1.default.existsSync(node_path_1.default.join(resourceApiContracts, "api-contracts.json"))) {
        report.manual_actions.push("将产品维护的 API Contract 配置与服务目录从 references/engineering/api_contracts/ 迁移到 resources/api_contracts/；框架不会自动移动产品资产。");
    }
    const deprecatedApifoxProjectSync = node_path_1.default.join(projectRoot, "references", "integrations", "apifox-project-sync.json");
    if (node_fs_1.default.existsSync(deprecatedApifoxProjectSync)) {
        report.manual_actions.push("检测到已停用的 references/integrations/apifox-project-sync.json；update 不会删除产品工作区文件，请人工确认后处理。");
    }
    const deprecatedApiActionCatalog = node_path_1.default.join(projectRoot, "resources", "api_contracts", "api-action-catalog.json");
    if (node_fs_1.default.existsSync(deprecatedApiActionCatalog)) {
        report.manual_actions.push("检测到已停用的 resources/api_contracts/api-action-catalog.json；Action 已归属 Karate 公共测试资产，请人工确认内容已迁移到公共 Action Feature 后处理。");
    }
    addAction(report, projectRoot, mergeIntegrationsJson(projectRoot));
    const agents = (0, codexAgents_1.installCodexAgents)(projectRoot);
    for (const action of agents.actions)
        addAction(report, projectRoot, action);
    for (const file of agents.conflicts)
        report.manual_actions.push(`Codex 子 Agent 文件冲突，已保留自定义文件：${file}；确认后移走冲突文件并重新 update。`);
    for (const action of (0, projectIgnore_1.appendProjectGitignoreEntries)(projectRoot)) {
        addAction(report, projectRoot, action);
    }
    report.unexpected_framework_files = (0, frameworkFiles_1.listUnexpectedFrameworkFiles)(projectRoot);
    return report;
}
