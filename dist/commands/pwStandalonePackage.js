"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pwStandalonePackageCommand = pwStandalonePackageCommand;
const node_crypto_1 = __importDefault(require("node:crypto"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_child_process_1 = require("node:child_process");
const REQUIRED_TOOLS = ["openapi_fetcher", "openapi_document_builder", "api_contract_registry", "playwright_test_asset_check", "playwright_test_run", "playwright_runtime", "playwright_agents_init", "delivery_test_report"];
const SKILLS = {
    "api-contract-maintainer": "api-contract-maintainer",
    "test-case-designer": "test-case-designer",
    "test-case-reviewer": "test-case-reviewer",
    "api-test-designer-pw": "api-test-designer",
    "ui-test-designer-pw": "ui-test-designer",
    "api-test-asset-maintainer-pw": "test-asset-maintainer",
    "test-executor-pw": "test-executor",
};
const REQUIRED_SOURCE_FILES = [
    "docs/pw-standalone-packaging.md",
    "framework/scaffold/AGENTS.md", "framework/scaffold/resources/README.md", "framework/scaffold/resources/api_test_scenarios-pw/README.md",
    "framework/_aiprod/PROTOCOL.md", "framework/_aiprod/adapters/playwright-cli-pw/ADAPTER.md", "framework/_aiprod/routines/playwright-testing-pw/ROUTINE.md",
    "src/core/openapi.ts", "src/core/playwrightRuntime.ts", "src/core/testContractSnapshot.ts", "src/tools/apiContractVerification.ts",
    "src/tools/openapiFetcher.ts", "src/tools/openapiDocumentBuilder.ts", "src/tools/apiContractRegistry.ts", "src/tools/playwrightTestAssetCheck.ts", "src/tools/playwrightTestRun.ts", "src/tools/playwrightRuntime.ts", "src/tools/playwrightAgentsInit.ts", "src/tools/deliveryTestReport.ts",
    "framework/_aiprod/tools/api_contract_registry/README.md", "framework/_aiprod/tools/playwright_test_asset_check/README.md", "framework/_aiprod/tools/playwright_test_run/README.md", "framework/_aiprod/tools/playwright_runtime/README.md", "framework/_aiprod/tools/playwright_agents_init/README.md", "framework/_aiprod/tools/delivery_test_report/README.md",
];
function hash(file) { return node_crypto_1.default.createHash("sha256").update(node_fs_1.default.readFileSync(file)).digest("hex"); }
function files(root) { return node_fs_1.default.existsSync(root) ? node_fs_1.default.readdirSync(root, { withFileTypes: true }).flatMap((entry) => { const file = node_path_1.default.join(root, entry.name); return entry.isDirectory() ? files(file) : entry.isFile() ? [file] : []; }) : []; }
function frameworkRoot() { return node_path_1.default.resolve(__dirname, "..", ".."); }
function inside(root, target) { const relative = node_path_1.default.relative(root, target); return !relative.startsWith("..") && !node_path_1.default.isAbsolute(relative); }
function required(args, name) { const index = args.indexOf(name); if (index < 0 || !args[index + 1])
    throw new Error(`${name} is required`); const value = args[index + 1]; args.splice(index, 2); return value; }
function readJson(file) { return JSON.parse(node_fs_1.default.readFileSync(file, "utf8")); }
function writeJson(file, value) { node_fs_1.default.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8"); }
function command(root, args) { const result = (0, node_child_process_1.spawnSync)("git", args, { cwd: root, encoding: "utf8", windowsHide: true }); if (result.status !== 0)
    throw new Error((result.stderr || result.stdout).trim() || `git ${args.join(" ")} failed`); return result.stdout.trim(); }
function packageContentHash(root) {
    const excluded = new Set(["framework-baseline.json", "framework-baseline.patch", "packaging-audit.md"]);
    const included = files(root).filter((file) => { const relative = node_path_1.default.relative(root, file).replace(/\\\\/g, "/"); return !/\\(node_modules|\.git|test-results|playwright-report)\\|\\dist\\|\\test-suites\\[^\\]+\\reports\\/.test(file) && !file.endsWith("config\\local.json") && !excluded.has(relative); });
    const value = included.map((file) => `${node_path_1.default.relative(root, file).replace(/\\\\/g, "/")}:${hash(file)}`).sort().join("\n");
    return node_crypto_1.default.createHash("sha256").update(value).digest("hex");
}
function requiredDifference(id, type, reason, sourceTargets) {
    return { id, type, reason, sourceTargets, impact: "仅替换独立包运行边界，不改变框架测试语义。", alternative: "由独立包 CLI、目录和本地依赖提供等价能力。", owner: "产品工作台维护负责人", confirmedAt: new Date().toISOString(), reviewCondition: "框架基准、独立实现或映射变化时重新复核。" };
}
function generatedBaseline(framework, workbench, allowDirty) {
    const entries = [];
    for (const [sourceSkill, targetSkill] of Object.entries(SKILLS)) {
        const sourceRoot = node_path_1.default.join(framework, "framework", "_aiprod", "skills", sourceSkill);
        for (const source of files(sourceRoot)) {
            const relative = node_path_1.default.relative(sourceRoot, source).replace(/\\/g, "/");
            const target = node_path_1.default.join(workbench, "skills", targetSkill, relative);
            entries.push({ source: node_path_1.default.relative(framework, source).replace(/\\/g, "/"), target: node_path_1.default.relative(workbench, target).replace(/\\/g, "/"), kind: relative === "SKILL.md" ? "skill" : "skill-reference", status: "adapted", sourceSha256: hash(source), ...(node_fs_1.default.existsSync(target) ? { targetSha256: hash(target) } : {}), adaptationId: "standalone-path-command-runtime-v1", adaptation: "替换 AIProd 路径、命令、目录和运行时；保留语义。", verification: ["reference-exists", "independence-scan", "fixture-check"] });
        }
    }
    const matrix = node_path_1.default.join(workbench, "tool-matrix.json");
    const sourceOnly = [...REQUIRED_SOURCE_FILES, ...files(node_path_1.default.join(framework, "framework", "scaffold", "resources", "api_test_scenarios-pw")).map((file) => node_path_1.default.relative(framework, file).replace(/\\/g, "/"))];
    for (const relative of [...new Set(sourceOnly)])
        if (!entries.some((entry) => entry.source === relative) && node_fs_1.default.existsSync(node_path_1.default.join(framework, relative)))
            entries.push({ source: relative, target: "tool-matrix.json", kind: "tool-or-scaffold-mapping", status: "adapted", sourceSha256: hash(node_path_1.default.join(framework, relative)), ...(node_fs_1.default.existsSync(matrix) ? { targetSha256: hash(matrix) } : {}), adaptationId: "source-to-tool-matrix-v1", adaptation: "此框架源码、工具说明或 scaffold 文件由 tool-matrix.json 中的独立命令、目录和报告模型逐项映射；多来源映射已由该适配 ID 显式登记。", verification: ["tool-matrix", "independence-scan", "fixture-check"] });
    const patch = command(framework, ["diff", "--binary"]);
    let baselineWorkingTree = { clean: true };
    if (patch) {
        if (!allowDirty)
            throw new Error("Framework working tree is dirty; rerun manifest with --allow-dirty-baseline after maintainer approval");
        const patchFile = "framework-baseline.patch";
        node_fs_1.default.writeFileSync(node_path_1.default.join(workbench, patchFile), patch, "utf8");
        baselineWorkingTree = { clean: false, patchSha256: node_crypto_1.default.createHash("sha256").update(patch).digest("hex"), patchFile, approvedBy: "产品工作台维护负责人（本次明确授权）", approvedAt: new Date().toISOString() };
    }
    return { version: 1, frameworkCommit: command(framework, ["rev-parse", "HEAD"]), frameworkVersion: node_fs_1.default.readFileSync(node_path_1.default.join(framework, "framework", "VERSION"), "utf8").trim(), packagedAt: new Date().toISOString(), baselineWorkingTree, entries, differences: [requiredDifference("directory-contracts", "path", "独立包使用 contracts/。", ["resources/api_contracts/ -> contracts/"]), requiredDifference("directory-assets", "path", "独立包使用 assets/。", ["resources/api_test_scenarios-pw/ -> assets/"]), requiredDifference("runtime-local-node", "runtime", "独立包使用自身锁定的 Node/Playwright 依赖。", ["AIProd 用户级 PW Runtime -> package-lock.json dependencies"]), requiredDifference("report-suite-model", "report-model", "独立包以 suite 替代 Change/Task。", ["AIProd Test Run / Delivery Report -> test-suites/{suite-id}/reports/"]), requiredDifference("source-to-tool-matrix-v1", "command", "多个框架工具、说明和 scaffold 来源由矩阵逐项映射。", ["framework tool/scaffold sources -> tool-matrix.json"])] };
}
function audit(framework, workbench) {
    const errors = [];
    const baselineFile = node_path_1.default.join(workbench, "framework-baseline.json");
    const matrixFile = node_path_1.default.join(workbench, "tool-matrix.json");
    if (!node_fs_1.default.existsSync(baselineFile))
        errors.push("Missing framework-baseline.json");
    const baseline = node_fs_1.default.existsSync(baselineFile) ? readJson(baselineFile) : undefined;
    if (baseline) {
        try {
            command(framework, ["cat-file", "-e", `${baseline.frameworkCommit}^{commit}`]);
        }
        catch {
            errors.push(`Framework commit does not exist: ${baseline.frameworkCommit}`);
        }
        if (!baseline.baselineWorkingTree)
            errors.push("Manifest is missing baselineWorkingTree");
        else if (baseline.baselineWorkingTree.clean === false) {
            const patch = node_path_1.default.resolve(workbench, baseline.baselineWorkingTree.patchFile);
            if (!inside(workbench, patch) || !node_fs_1.default.existsSync(patch))
                errors.push("Dirty baseline patch is missing or outside the workbench");
            else if (hash(patch) !== baseline.baselineWorkingTree.patchSha256)
                errors.push("Dirty baseline patch hash changed");
            if (!baseline.baselineWorkingTree.approvedBy || !baseline.baselineWorkingTree.approvedAt)
                errors.push("Dirty baseline requires maintainer approval metadata");
        }
        for (const difference of baseline.differences ?? []) {
            if (!difference.id || !Array.isArray(difference.sourceTargets) || difference.sourceTargets.length === 0 || !difference.reason || !difference.impact || !difference.alternative || !difference.owner || !difference.confirmedAt || !difference.reviewCondition)
                errors.push(`Difference is incomplete: ${difference.id || "<missing id>"}`);
        }
        if (!baseline.differences?.length)
            errors.push("Manifest is missing differences");
    }
    const requiredSources = [...REQUIRED_SOURCE_FILES.filter((item) => node_fs_1.default.existsSync(node_path_1.default.join(framework, item))), ...files(node_path_1.default.join(framework, "framework", "scaffold", "resources", "api_test_scenarios-pw")).map((file) => node_path_1.default.relative(framework, file).replace(/\\/g, "/")), ...Object.keys(SKILLS).flatMap((skill) => files(node_path_1.default.join(framework, "framework", "_aiprod", "skills", skill)).map((file) => node_path_1.default.relative(framework, file).replace(/\\/g, "/")))];
    for (const source of requiredSources)
        if (!baseline?.entries.some((entry) => entry.source === source))
            errors.push(`Manifest is missing required framework source: ${source}`);
    if (baseline)
        for (const entry of baseline.entries) {
            const source = node_path_1.default.resolve(framework, entry.source);
            const target = node_path_1.default.resolve(workbench, entry.target);
            if (!inside(framework, source) || !node_fs_1.default.existsSync(source))
                errors.push(`Missing framework source: ${entry.source}`);
            else if (entry.sourceSha256 !== hash(source))
                errors.push(`Framework source hash changed: ${entry.source}`);
            if (entry.status !== "unsupported" && entry.status !== "not-applicable") {
                if (!inside(workbench, target) || !node_fs_1.default.existsSync(target))
                    errors.push(`Missing workbench target: ${entry.target}`);
                else if (entry.targetSha256 !== hash(target))
                    errors.push(`Workbench target hash changed: ${entry.target}`);
            }
        }
    if (!node_fs_1.default.existsSync(matrixFile))
        errors.push("Missing tool-matrix.json");
    else {
        const matrix = readJson(matrixFile);
        for (const tool of REQUIRED_TOOLS) {
            const row = matrix.tools?.find((item) => item.frameworkTool === tool);
            if (!row)
                errors.push(`Tool matrix is missing ${tool}`);
            else {
                if (row.semanticParity !== true)
                    errors.push(`Tool matrix has no semantic parity for ${tool}`);
                for (const field of ["input", "output", "writes", "stateMachine", "blockedSemantics", "runtimeDependencies", "minimumVerification", "differenceId"])
                    if (!(field in row))
                        errors.push(`Tool matrix ${tool} is missing ${field}`);
            }
        }
    }
    if (!node_fs_1.default.existsSync(node_path_1.default.join(workbench, ".gitignore")))
        errors.push("Missing .gitignore");
    if (!node_fs_1.default.existsSync(node_path_1.default.join(workbench, ".npmignore")) && !node_fs_1.default.existsSync(node_path_1.default.join(workbench, "files")))
        errors.push("Missing release ignore rule (.npmignore or package files allow-list)");
    const traceFiles = new Set(["framework-baseline.json", "framework-baseline.patch", "packaging-audit.md"]);
    for (const file of files(workbench)) {
        const relative = node_path_1.default.relative(workbench, file).replace(/\\/g, "/");
        if (/^(node_modules|dist|test-suites\/[^/]+\/reports)\//.test(relative) || traceFiles.has(relative))
            continue;
        const content = node_fs_1.default.readFileSync(file, "utf8");
        if (/aiprod|_aiprod\//i.test(content))
            errors.push(`Standalone package contains reserved framework identifier: ${relative}`);
        else if (/Product Change|\bwork\/tasks\b/.test(content))
            errors.push(`Framework execution dependency: ${relative}`);
    }
    return { ok: errors.length === 0, errors, summary: { baseline_entries: baseline?.entries.length ?? 0, required_sources: requiredSources.length, required_tools: REQUIRED_TOOLS.length, framework_commit: baseline?.frameworkCommit ?? null, package_content_sha256: packageContentHash(workbench), lockfile_sha256: node_fs_1.default.existsSync(node_path_1.default.join(workbench, "package-lock.json")) ? hash(node_path_1.default.join(workbench, "package-lock.json")) : null, unsupported: baseline?.entries.filter((entry) => entry.status === "unsupported").length ?? 0 } };
}
function workbenchChecks(workbench) {
    const config = readJson(node_path_1.default.join(workbench, "config", "system.json"));
    const environment = config.system?.default_environment ?? "dev";
    const node = process.execPath;
    const cli = node_path_1.default.join(workbench, "dist", "cli.js");
    const commands = [
        ["system-validate", [cli, "system", "validate", "--environment", environment]],
        ["contract-check", [cli, "api", "check"]],
        ["asset-check", [cli, "assets", "check"]],
    ];
    const suites = node_path_1.default.join(workbench, "test-suites");
    if (node_fs_1.default.existsSync(suites))
        for (const entry of node_fs_1.default.readdirSync(suites, { withFileTypes: true }))
            if (entry.isDirectory())
                commands.push([`spec-list:${entry.name}`, [cli, "playwright", "list", "--suite", entry.name, "--environment", environment]]);
    return commands.map(([name, args]) => { const result = (0, node_child_process_1.spawnSync)(node, args, { cwd: workbench, encoding: "utf8", windowsHide: true }); return { name, ok: result.status === 0, output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim() }; });
}
function verify(framework, workbench) {
    const auditResult = audit(framework, workbench);
    const result = process.platform === "win32" ? (0, node_child_process_1.spawnSync)(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "npm run check"], { cwd: workbench, encoding: "utf8", windowsHide: true }) : (0, node_child_process_1.spawnSync)("npm", ["run", "check"], { cwd: workbench, encoding: "utf8", windowsHide: true });
    const checks = result.status === 0 ? workbenchChecks(workbench) : [];
    return { ok: auditResult.ok && result.status === 0 && checks.every((item) => item.ok), audit: auditResult, checks, output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim(), ...(result.error ? { error: result.error.message } : {}) };
}
function pwStandalonePackageCommand(raw) {
    try {
        const args = [...raw];
        const action = args.shift();
        const workbench = node_path_1.default.resolve(required(args, "--workbench"));
        const write = args.includes("--write");
        if (write)
            args.splice(args.indexOf("--write"), 1);
        const allowDirty = args.includes("--allow-dirty-baseline");
        if (allowDirty)
            args.splice(args.indexOf("--allow-dirty-baseline"), 1);
        if (args.length)
            throw new Error(`Unknown pw-standalone-package arguments: ${args.join(" ")}`);
        if (!node_fs_1.default.existsSync(workbench) || !node_fs_1.default.statSync(workbench).isDirectory())
            throw new Error(`Workbench does not exist: ${workbench}`);
        const framework = frameworkRoot();
        if (action === "manifest") {
            const baseline = generatedBaseline(framework, workbench, allowDirty);
            const file = node_path_1.default.join(workbench, "framework-baseline.json");
            if (write)
                writeJson(file, baseline);
            console.log(JSON.stringify({ ok: true, action, written: write, manifest: node_path_1.default.relative(workbench, file), entries: baseline.entries.length, framework_commit: baseline.frameworkCommit }, null, 2));
            return 0;
        }
        if (action === "audit") {
            const result = audit(framework, workbench);
            const auditFile = node_path_1.default.join(workbench, "packaging-audit.md");
            if (write)
                node_fs_1.default.writeFileSync(auditFile, `# PW 独立打包审计\n\n- 时间：${new Date().toISOString()}\n- 结论：${result.ok ? "passed" : "failed"}\n- 框架基准：${result.summary.framework_commit}\n- 清单项：${result.summary.baseline_entries}\n- 未支持项：${result.summary.unsupported}\n- 包内容 SHA-256：${result.summary.package_content_sha256}\n- 锁文件 SHA-256：${result.summary.lockfile_sha256}\n- 错误：${result.errors.length}\n\n## 差异与验收\n\n- 差异登记见 framework-baseline.json 的 differences。\n- 本次执行：aiprod pw-standalone-package audit --workbench <workbench> --write。\n- 仅本记录中的基准、包内容 SHA-256 与锁文件 SHA-256 同时匹配时，本审计才有效。\n\n## 错误\n\n${result.errors.length ? result.errors.map((item) => `- ${item}`).join("\n") : "- 无"}\n`, "utf8");
            console.log(JSON.stringify({ action, written: write, ...result, audit: write ? "packaging-audit.md" : undefined }, null, 2));
            return result.ok ? 0 : 1;
        }
        if (action === "verify") {
            const result = verify(framework, workbench);
            console.log(JSON.stringify({ action, verification: "offline-build-and-cli-load", ...result }, null, 2));
            return result.ok ? 0 : 1;
        }
        if (action === "release-check") {
            const result = verify(framework, workbench);
            const errors = [...result.audit.errors];
            const auditFile = node_path_1.default.join(workbench, "packaging-audit.md");
            if (!node_fs_1.default.existsSync(auditFile))
                errors.push("Missing packaging-audit.md; run audit --write first");
            else {
                const text = node_fs_1.default.readFileSync(auditFile, "utf8");
                if (!text.includes(`- 包内容 SHA-256：${result.audit.summary.package_content_sha256}`) || !text.includes(`- 锁文件 SHA-256：${result.audit.summary.lockfile_sha256}`) || !text.includes(`- 框架基准：${result.audit.summary.framework_commit}`))
                    errors.push("packaging-audit.md is stale; rerun audit --write");
            }
            if (!node_fs_1.default.existsSync(node_path_1.default.join(workbench, "package-lock.json")))
                errors.push("Missing package-lock.json");
            const ok = result.ok && errors.length === 0;
            console.log(JSON.stringify({ ok, action, audit: result.audit, verify: { ok: result.ok }, errors }, null, 2));
            return ok ? 0 : 1;
        }
        throw new Error("pw-standalone-package requires manifest, audit, verify or release-check");
    }
    catch (error) {
        console.log(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
        return 1;
    }
}
