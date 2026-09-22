"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initProject = initProject;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const fs_1 = require("./fs");
const launcher_1 = require("./launcher");
const paths_1 = require("./paths");
const frameworkFiles_1 = require("./frameworkFiles");
const projectIgnore_1 = require("./projectIgnore");
const codexAgents_1 = require("./codexAgents");
const standardDirs = [
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
const scaffoldFiles = [
    "AGENTS.md",
    "README.md",
    "aiprod.config.yaml",
    "specs/README.md",
    "specs/index.md",
    "specs/overview.md",
    "specs/glossary.md",
    "discoveries/README.md",
    "changes/README.md",
    "work/README.md",
    "work/document_sync/sync_rules.yaml",
    "work/document_sync/sync_rules.example.yaml",
    "work/document_sync/relations.json",
    "references/README.md",
    "references/integrations/integrations.json",
    "references/integrations/secrets.local.example.json",
    "resources/README.md",
    "resources/api_contracts/api-contracts.example.json",
    "resources/api_test_scenarios-pw/README.md",
    "resources/api_test_scenarios-pw/knowledge/README.md",
    "resources/api_test_scenarios-ka/config/karate-config.js",
    "resources/api_test_scenarios-pw/config/playwright.config.ts",
    "resources/api_test_scenarios-pw/support/assets.ts",
    "resources/api_test_scenarios-pw/support/test.ts",
    "demos/README.md",
    "docs/README.md",
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
function initProject(projectRoot) {
    (0, fs_1.ensureDir)(projectRoot);
    const report = { ok: true, project: projectRoot, created: [], updated: [], new_files: [], skipped: [], manual_actions: [] };
    for (const dir of standardDirs) {
        const fullPath = node_path_1.default.join(projectRoot, dir);
        if (!node_fs_1.default.existsSync(fullPath)) {
            (0, fs_1.ensureDir)(fullPath);
            report.created.push(dir);
        }
        else {
            report.skipped.push(dir);
        }
    }
    for (const action of (0, frameworkFiles_1.copyFrameworkPayload)(projectRoot, "skip")) {
        addAction(report, projectRoot, action);
    }
    for (const action of (0, launcher_1.installProjectRuntime)(projectRoot)) {
        addAction(report, projectRoot, action);
    }
    for (const sourceFile of scaffoldFiles) {
        const content = (0, fs_1.readText)(node_path_1.default.join((0, paths_1.scaffoldDir)(), sourceFile)).replaceAll("{{FRAMEWORK_VERSION}}", (0, fs_1.readText)((0, paths_1.frameworkVersionPath)()).trim());
        addAction(report, projectRoot, (0, fs_1.writeManagedFile)(node_path_1.default.join(projectRoot, sourceFile), content, "new"));
    }
    const agents = (0, codexAgents_1.installCodexAgents)(projectRoot);
    for (const action of agents.actions)
        addAction(report, projectRoot, action);
    for (const file of agents.conflicts)
        report.manual_actions.push(`Codex 子 Agent 文件冲突，已保留自定义文件：${file}；确认后移走冲突文件并重新 update。`);
    for (const action of (0, projectIgnore_1.appendProjectGitignoreEntries)(projectRoot)) {
        addAction(report, projectRoot, action);
    }
    return report;
}
