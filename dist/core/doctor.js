"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.doctorProject = doctorProject;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const fs_1 = require("./fs");
const frameworkFiles_1 = require("./frameworkFiles");
const projectIgnore_1 = require("./projectIgnore");
const codexAgents_1 = require("./codexAgents");
const playwrightRuntime_1 = require("./playwrightRuntime");
function doctorProject(projectRoot) {
    const checks = [];
    const check = (name, ok, detail) => checks.push({ name, ok, detail });
    check("node", Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10) >= 20, `Node ${process.version}`);
    for (const dir of [
        "_aiprod",
        "specs",
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
        "references/integrations",
        "resources/api_contracts",
        "resources/api_test_scenarios-ka/config",
        "resources/api_test_scenarios-pw/config",
        "resources/api_test_scenarios-pw/support",
        "demos",
        "docs",
    ]) {
        const fullPath = node_path_1.default.join(projectRoot, dir);
        check(`dir:${dir}`, node_fs_1.default.existsSync(fullPath) && node_fs_1.default.statSync(fullPath).isDirectory(), fullPath);
    }
    for (const file of [
        "specs/README.md",
        "specs/index.md",
        "specs/overview.md",
        "specs/glossary.md",
        "discoveries/README.md",
        "changes/README.md",
        "work/README.md",
        "references/README.md",
        "resources/README.md",
        "resources/api_contracts/api-contracts.example.json",
        "resources/api_test_scenarios-ka/config/karate-config.js",
        "resources/api_test_scenarios-pw/config/playwright.config.ts",
        "resources/api_test_scenarios-pw/support/assets.ts",
        "resources/api_test_scenarios-pw/support/test.ts",
        "demos/README.md",
        "docs/README.md",
    ]) {
        const fullPath = node_path_1.default.join(projectRoot, file);
        check(`file:${file}`, node_fs_1.default.existsSync(fullPath) && node_fs_1.default.statSync(fullPath).isFile(), fullPath);
    }
    const versionPath = node_path_1.default.join(projectRoot, "_aiprod", "VERSION");
    for (const [index, file] of codexAgents_1.codexAgentPaths.entries()) {
        const fullPath = node_path_1.default.join(projectRoot, file);
        const valid = node_fs_1.default.existsSync(fullPath) && node_fs_1.default.lstatSync(fullPath).isFile()
            && (0, fs_1.readText)(fullPath).split(/\r?\n/, 1)[0] === `# AIProd-managed Codex agent: ${codexAgents_1.codexAgentNames[index]}`;
        check(`codex-agent:${codexAgents_1.codexAgentNames[index]}`, valid, valid ? file : `${file} missing or custom conflict; run update and review manual_actions`);
    }
    check("framework-version-file", node_fs_1.default.existsSync(versionPath), versionPath);
    if (node_fs_1.default.existsSync(versionPath)) {
        check("framework-version-value", (0, fs_1.readText)(versionPath).trim().length > 0, (0, fs_1.readText)(versionPath).trim());
    }
    const configPath = node_path_1.default.join(projectRoot, "aiprod.config.yaml");
    check("config", node_fs_1.default.existsSync(configPath), configPath);
    if (node_fs_1.default.existsSync(configPath)) {
        const content = (0, fs_1.readText)(configPath);
        const hasConfigFrameworkVersion = /framework_version\s*:/.test(content);
        check("config-framework-version", hasConfigFrameworkVersion || node_fs_1.default.existsSync(versionPath), hasConfigFrameworkVersion ? "framework_version field" : "using _aiprod/VERSION for framework version");
    }
    const integrationsPath = node_path_1.default.join(projectRoot, "references", "integrations", "integrations.json");
    let integrationsConfig = {};
    try {
        integrationsConfig = (0, fs_1.readJson)(integrationsPath, true);
        check("integrations-json", true, integrationsPath);
    }
    catch (error) {
        check("integrations-json", false, error instanceof Error ? error.message : String(error));
    }
    const secretsPath = node_path_1.default.join(projectRoot, "references", "integrations", "secrets.local.json");
    check("secrets-local", true, node_fs_1.default.existsSync(secretsPath) ? `${secretsPath} exists` : `${secretsPath} not found; create it only when local secrets are needed`);
    const deprecatedApifoxProjectSync = node_path_1.default.join(projectRoot, "references", "integrations", "apifox-project-sync.json");
    check("deprecated:references/integrations/apifox-project-sync.json", !node_fs_1.default.existsSync(deprecatedApifoxProjectSync), node_fs_1.default.existsSync(deprecatedApifoxProjectSync) ? `${deprecatedApifoxProjectSync}; retired Apifox-generated file, review and remove manually when appropriate` : "none");
    const karateDefaultOutput = node_path_1.default.join(projectRoot, "target");
    const karateDefaultArtifacts = ["karate.log", "karate-summary.html"]
        .filter((file) => node_fs_1.default.existsSync(node_path_1.default.join(karateDefaultOutput, file)));
    check("karate-default-output", karateDefaultArtifacts.length === 0, karateDefaultArtifacts.length > 0
        ? `Detected Karate default output: ${karateDefaultArtifacts.map((file) => node_path_1.default.join("target", file)).join(", ")}. Review and remove it, then rerun Karate with an explicit --output directory under .aiprod-local/test-reports/karate/.`
        : "none");
    check("tool:integration_resolver", true, "available through AIProd Web UI or _aiprod/runtime/aiprod-launcher.cjs");
    check("tool:openapi_fetcher", true, "available through _aiprod/runtime/aiprod-launcher.cjs");
    check("tool:api_contract_registry", true, "available through _aiprod/runtime/aiprod-launcher.cjs");
    check("tool:openapi_document_builder", true, "available through _aiprod/runtime/aiprod-launcher.cjs");
    check("tool:task_status_updater", true, "available through AIProd Web UI or _aiprod/runtime/aiprod-launcher.cjs");
    check("tool:agent_run_logger", true, "available through AIProd Web UI or _aiprod/runtime/aiprod-launcher.cjs");
    check("tool:information_density_evaluator", true, "available through AIProd Web UI or _aiprod/runtime/aiprod-launcher.cjs");
    check("tool:delivery_test_report", true, "available through _aiprod/runtime/aiprod-launcher.cjs");
    check("tool:karate_test_asset_check", true, "available through _aiprod/runtime/aiprod-launcher.cjs");
    check("tool:karate_test_run", true, "available through _aiprod/runtime/aiprod-launcher.cjs with console output redirected to local report logs");
    check("tool:playwright_test_asset_check", true, "available through _aiprod/runtime/aiprod-launcher.cjs");
    check("tool:playwright_test_run", true, "available through _aiprod/runtime/aiprod-launcher.cjs with console output redirected to local report logs");
    check("tool:playwright_agents_init", true, "available through _aiprod/runtime/aiprod-launcher.cjs; explicit invocation installs official Codex agents with AIProd governance overlays");
    check("tool:playwright_runtime", true, "manages the AIProd user-level Playwright runtime shared by product workspaces");
    const integrations = integrationsConfig.integrations && typeof integrationsConfig.integrations === "object" && !Array.isArray(integrationsConfig.integrations)
        ? integrationsConfig.integrations
        : {};
    const requiresPlaywright = Object.values(integrations).some((value) => {
        if (!value || typeof value !== "object" || Array.isArray(value))
            return false;
        const integration = value;
        return integration.adapter === "playwright-cli-pw" && integration.enabled !== false;
    });
    const playwrightRuntime = (0, playwrightRuntime_1.getPlaywrightRuntimeStatus)();
    check("playwright-shared-runtime", !requiresPlaywright || playwrightRuntime.installed, playwrightRuntime.installed
        ? `AIProd shared Playwright ${playwrightRuntime.installedVersion} at ${playwrightRuntime.paths.root}; chromium ${playwrightRuntime.browsers.chromium.installed ? "installed" : "not installed"}`
        : requiresPlaywright
            ? `Playwright integration is enabled but AIProd shared runtime ${playwrightRuntime.expectedVersion} is not installed; run playwright_runtime install`
            : `not required by an enabled integration; expected shared runtime ${playwrightRuntime.expectedVersion}`);
    const unexpectedFrameworkFiles = (0, frameworkFiles_1.listUnexpectedFrameworkFiles)(projectRoot);
    check("framework-extra-files", unexpectedFrameworkFiles.length === 0, unexpectedFrameworkFiles.length > 0 ? unexpectedFrameworkFiles.join("\n") : "none");
    const trackedNonProjectAssets = (0, projectIgnore_1.listTrackedNonProjectAssets)(projectRoot);
    check("non-project-assets-untracked", trackedNonProjectAssets.length === 0, trackedNonProjectAssets.length > 0
        ? `These AIProd runtime/local files should not be tracked by project Git:\n${trackedNonProjectAssets.join("\n")}`
        : `ignored by init/update: ${projectIgnore_1.projectGitignoreEntries.join(", ")}`);
    return { ok: checks.every((item) => item.ok), project: projectRoot, checks };
}
