"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testWorkspaceScaffoldFiles = exports.testWorkspaceDirectories = exports.testWorkspacePayloadDirectories = void 0;
exports.provisionTestWorkspace = provisionTestWorkspace;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const fs_1 = require("./fs");
const paths_1 = require("./paths");
const launcher_1 = require("./launcher");
const update_1 = require("./update");
// This is intentionally independent of product-workspace init/update. Every entry is an existing framework asset.
exports.testWorkspacePayloadDirectories = [
    "skills/api-contract-maintainer", "skills/test-case-designer", "skills/test-case-reviewer",
    "skills/api-test-designer-pw", "skills/ui-test-designer-pw", "skills/api-test-asset-maintainer-pw", "skills/test-executor-pw",
    "routines/playwright-testing-pw", "adapters/playwright-cli-pw",
    "tools/integration_resolver", "tools/openapi_fetcher", "tools/openapi_document_builder", "tools/api_contract_registry",
    "tools/playwright_test_asset_check", "tools/playwright_test_run", "tools/playwright_runtime", "tools/playwright_agents_init", "tools/delivery_test_report",
];
exports.testWorkspaceDirectories = [
    "references/integrations", "resources/api_contracts", "resources/api_test_scenarios-pw/config", "resources/api_test_scenarios-pw/support", "resources/api_test_scenarios-pw/knowledge",
    "work/testing", "work/document_sync", ".aiprod-local/test-reports/playwright", ".aiprod-local/playground", ".codex/agents",
];
exports.testWorkspaceScaffoldFiles = [
    "references/integrations/integrations.json", "references/integrations/secrets.local.example.json",
    // These directory READMEs are public contracts for the directories exposed by
    // the test workspace. Keep them in the same source list used by the standalone
    // package builder so package init and in-repository init stay identical.
    "work/README.md", "references/README.md", "resources/README.md",
    "resources/api_contracts/api-contracts.example.json", "resources/api_test_scenarios-pw/README.md",
    "resources/api_test_scenarios-pw/knowledge/README.md", "resources/api_test_scenarios-pw/config/playwright.config.ts",
    "resources/api_test_scenarios-pw/support/assets.ts", "resources/api_test_scenarios-pw/support/test.ts",
    "work/document_sync/relations.json",
];
const testWorkspaceRefreshScaffoldFiles = new Set(exports.testWorkspaceScaffoldFiles.filter((file) => update_1.refreshScaffoldFiles.includes(file)));
const testWorkspaceMissingOnlyScaffoldFiles = new Set(exports.testWorkspaceScaffoldFiles.filter((file) => update_1.missingOnlyScaffoldFiles.includes(file)));
function collect(report, root, actions) { for (const action of actions) {
    const relative = node_path_1.default.relative(root, action.path);
    if (action.action === "created")
        report.created.push(relative);
    else if (action.action === "updated")
        report.updated.push(relative);
    else
        report.skipped.push(relative);
} }
function provisionTestWorkspace(workspace, mode) {
    (0, fs_1.ensureDir)(workspace);
    const report = { ok: true, workspace, created: [], updated: [], skipped: [] };
    for (const dir of exports.testWorkspaceDirectories) {
        const target = node_path_1.default.join(workspace, dir);
        if (node_fs_1.default.existsSync(target))
            report.skipped.push(dir);
        else {
            (0, fs_1.ensureDir)(target);
            report.created.push(dir);
        }
    }
    const writeMode = mode === "init" ? "skip" : "overwrite";
    for (const relative of exports.testWorkspacePayloadDirectories)
        collect(report, workspace, (0, fs_1.copyDirectory)(node_path_1.default.join((0, paths_1.frameworkAiprodDir)(), relative), node_path_1.default.join(workspace, "_aiprod", relative), writeMode));
    collect(report, workspace, [(0, fs_1.writeManagedFile)(node_path_1.default.join(workspace, "AGENTS.md"), (0, fs_1.readText)(node_path_1.default.join((0, paths_1.testScaffoldDir)(), "AGENTS.md")), mode === "init" ? "new" : "overwrite")]);
    for (const file of exports.testWorkspaceScaffoldFiles) {
        if (file === "references/integrations/integrations.json") {
            if (mode === "update")
                collect(report, workspace, [(0, update_1.mergeIntegrationsJson)(workspace)]);
            else
                collect(report, workspace, [(0, fs_1.writeManagedFile)(node_path_1.default.join(workspace, file), (0, fs_1.readText)(node_path_1.default.join((0, paths_1.scaffoldDir)(), file)), "new")]);
            continue;
        }
        const writeMode = mode === "init" ? "new" : testWorkspaceRefreshScaffoldFiles.has(file) ? "overwrite" : "skip";
        if (!testWorkspaceRefreshScaffoldFiles.has(file) && !testWorkspaceMissingOnlyScaffoldFiles.has(file))
            throw new Error(`Test workspace scaffold update policy is missing: ${file}`);
        collect(report, workspace, [(0, fs_1.writeManagedFile)(node_path_1.default.join(workspace, file), (0, fs_1.readText)(node_path_1.default.join((0, paths_1.scaffoldDir)(), file)), writeMode)]);
    }
    collect(report, workspace, (0, launcher_1.installProjectRuntime)(workspace, "commands/testWorkspaceRuntimeCli.js"));
    for (const entry of ["_aiprod/", ".aiprod-local/", ".codex/", "references/integrations/secrets.local.json"])
        collect(report, workspace, [(0, fs_1.appendGitignoreEntry)(workspace, entry)]);
    const version = (0, fs_1.readText)((0, paths_1.frameworkVersionPath)()).trim();
    collect(report, workspace, [(0, fs_1.writeManagedFile)(node_path_1.default.join(workspace, "_aiprod", "VERSION"), `${version}\n`, "overwrite")]);
    return report;
}
