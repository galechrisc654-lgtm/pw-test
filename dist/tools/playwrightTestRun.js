"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.playwrightTestRunTool = void 0;
exports.runPlaywrightTest = runPlaywrightTest;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_child_process_1 = require("node:child_process");
const playwrightRuntime_1 = require("../core/playwrightRuntime");
const testContractSnapshot_1 = require("../core/testContractSnapshot");
const args_1 = require("./args");
const deliveryTestReport_1 = require("./deliveryTestReport");
const integrationResolver_1 = require("./integrationResolver");
const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const displayPath = (root, value) => node_path_1.default.relative(root, value).split(node_path_1.default.sep).join("/");
function requiredText(value, name) { if (typeof value !== "string" || !value.trim())
    throw new Error(`${name} is required`); return value.trim(); }
function stableId(value, option) { if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(value))
    throw new Error(`${option} must be a single stable ID`); return value; }
function projectPath(root, value, label) {
    const target = node_path_1.default.resolve(root, value);
    const relative = node_path_1.default.relative(root, target);
    if (!relative || relative.startsWith("..") || node_path_1.default.isAbsolute(relative))
        throw new Error(`${label} must be inside the project root: ${value}`);
    return target;
}
function resolveScope(options) {
    if (Number(Boolean(options.change)) + Number(Boolean(options.testingDir)) + Number(options.simulation) !== 1)
        throw new Error("Provide exactly one of --change, --testing-dir or --simulation");
    if (options.change) {
        const id = stableId(options.change, "--change");
        return { kind: "change", id, relativeTestingDirectory: `changes/${id}/testing-pw` };
    }
    if (options.testingDir) {
        const normalized = options.testingDir.replace(/\\/g, "/").replace(/\/$/, "");
        const match = /^work\/testing\/([A-Za-z0-9][A-Za-z0-9_-]*)$/.exec(normalized);
        if (!match)
            throw new Error("--testing-dir must be work/testing/{test_id}");
        return { kind: "independent", id: match[1], relativeTestingDirectory: `${normalized}/testing-pw` };
    }
    return { kind: "simulation", id: "simulation", relativeTestingDirectory: null };
}
function assertReviewed(root, scope) {
    if (scope.kind === "simulation")
        return;
    const file = node_path_1.default.join(root, ...scope.relativeTestingDirectory.split("/"), "test-cases.md");
    if (!node_fs_1.default.existsSync(file) || !/^>\s*审核状态：\s*已审核\s*$/m.test(node_fs_1.default.readFileSync(file, "utf8")))
        throw new Error(`${displayPath(root, file)} must exist and be explicitly marked 审核状态：已审核 before Playwright execution`);
}
function defaultRunId() {
    const now = new Date();
    const date = [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((item) => String(item).padStart(2, "0")).join("");
    const time = [now.getHours(), now.getMinutes(), now.getSeconds()].map((item) => String(item).padStart(2, "0")).join("");
    return `TR-PW-${date}-${time}-${String(now.getMilliseconds()).padStart(3, "0")}`;
}
function runDirectory(root, scope, list, runId) {
    const base = node_path_1.default.join(root, ".aiprod-local", "test-reports", "playwright");
    if (scope.kind === "simulation")
        return node_path_1.default.join(base, "simulations", runId, "raw");
    const type = list ? "dry-runs" : "runs";
    return scope.kind === "change" ? node_path_1.default.join(base, "changes", scope.id, type, runId, "raw") : node_path_1.default.join(base, "independent", scope.id, type, runId, "raw");
}
function compactFailure(message) {
    console.log(JSON.stringify({ ok: false, status: "blocked", error: message, next_step: "Fix the configuration or scope error, then run playwright_test_run again." }));
    return 1;
}
function reportedTestCount(file) {
    if (!node_fs_1.default.existsSync(file))
        return undefined;
    try {
        const report = JSON.parse(node_fs_1.default.readFileSync(file, "utf8"));
        const stats = isRecord(report.stats) ? report.stats : {};
        return ["expected", "skipped", "unexpected", "flaky"].reduce((total, key) => total + (typeof stats[key] === "number" ? stats[key] : 0), 0);
    }
    catch {
        return undefined;
    }
}
function runPlaywrightTest(options) {
    try {
        const scope = resolveScope(options);
        assertReviewed(options.projectRoot, scope);
        if (!Number.isInteger(options.workers) || options.workers < 1)
            throw new Error("--workers must be a positive integer");
        if (options.tests.length === 0)
            throw new Error("At least one --test is required");
        const resolved = (0, integrationResolver_1.resolveIntegration)({ id: options.integration, raw: true, projectRoot: options.projectRoot });
        if (resolved.adapter !== "playwright-cli-pw")
            throw new Error(`Integration ${options.integration} must use adapter playwright-cli-pw`);
        if (resolved.enabled !== true)
            throw new Error(`Integration is disabled: ${options.integration}`);
        const params = resolved.params;
        const runtime = (0, playwrightRuntime_1.requirePlaywrightRuntime)();
        const environments = params.environments;
        if (!isRecord(environments))
            throw new Error("integration params.environments must be an object");
        const environmentName = options.environment ?? requiredText(params.default_environment, "integration params.default_environment");
        const targetEnvironment = environments[environmentName];
        if (!isRecord(targetEnvironment))
            throw new Error(`Environment not found in integration: ${environmentName}`);
        const contract = (0, testContractSnapshot_1.contractSnapshot)(options.projectRoot, targetEnvironment);
        const configFile = node_path_1.default.join(options.projectRoot, "resources", "api_test_scenarios-pw", "config", "playwright.config.ts");
        if (!node_fs_1.default.existsSync(configFile))
            throw new Error(`Playwright config not found: ${displayPath(options.projectRoot, configFile)}`);
        const cliPath = runtime.paths.cli;
        const tests = options.tests.map((test) => { const target = projectPath(options.projectRoot, test, "test"); if (!node_fs_1.default.existsSync(target))
            throw new Error(`Test path not found: ${target}`); return target; });
        const testArguments = options.tests.map((test) => test.replace(/\\/g, "/"));
        const reportRequired = !options.list && scope.kind !== "simulation";
        const runScope = reportRequired ? requiredText(options.runScope, "--scope") : undefined;
        if (reportRequired) {
            const testing = node_path_1.default.join(options.projectRoot, ...scope.relativeTestingDirectory.split("/"));
            for (const file of ["test-report.md", "test-runs.md"])
                if (!node_fs_1.default.existsSync(node_path_1.default.join(testing, file)))
                    throw new Error(`Initialize the PW delivery test report first: ${displayPath(options.projectRoot, node_path_1.default.join(testing, file))}`);
        }
        const runId = stableId(options.runId ?? defaultRunId(), "--run-id");
        const output = runDirectory(options.projectRoot, scope, options.list, runId);
        if (node_fs_1.default.existsSync(output))
            throw new Error(`Run output already exists: ${output}`);
        node_fs_1.default.mkdirSync(output, { recursive: true });
        const htmlDir = node_path_1.default.join(output, "html");
        const jsonReport = node_path_1.default.join(output, "results.json");
        const stdoutLog = node_path_1.default.join(output, "playwright-stdout.log");
        const stderrLog = node_path_1.default.join(output, "playwright-stderr.log");
        const resultDir = node_path_1.default.join(output, "test-results");
        const commandArgs = [cliPath, "test", "--config", configFile, "--workers", String(options.workers), "--output", resultDir,
            ...options.projects.map((project) => `--project=${project}`), ...(options.grep ? ["--grep", options.grep] : []), ...(options.list ? ["--list"] : []), ...testArguments];
        const childEnvironment = (0, playwrightRuntime_1.playwrightRuntimeEnvironment)({
            ...process.env,
            AIPROD_PW_PROJECT_ROOT: options.projectRoot.replace(/\\/g, "/"),
            AIPROD_PW_ENV_JSON: JSON.stringify(targetEnvironment),
            PLAYWRIGHT_HTML_OUTPUT_DIR: htmlDir,
            PLAYWRIGHT_HTML_OPEN: "never",
            PLAYWRIGHT_JSON_OUTPUT_FILE: jsonReport,
        });
        let result;
        const stdoutFd = node_fs_1.default.openSync(stdoutLog, "w");
        const stderrFd = node_fs_1.default.openSync(stderrLog, "w");
        try {
            result = (0, node_child_process_1.spawnSync)(process.execPath, commandArgs, { cwd: options.projectRoot, env: childEnvironment, stdio: ["ignore", stdoutFd, stderrFd], windowsHide: true });
        }
        finally {
            node_fs_1.default.closeSync(stdoutFd);
            node_fs_1.default.closeSync(stderrFd);
        }
        const exitCode = typeof result.status === "number" ? result.status : 1;
        const htmlReport = node_path_1.default.join(htmlDir, "index.html");
        const hasRequiredArtifacts = options.list || (node_fs_1.default.existsSync(htmlReport) && node_fs_1.default.existsSync(jsonReport));
        const testCount = reportedTestCount(jsonReport);
        const executionStatus = result.error || !hasRequiredArtifacts || testCount === 0 ? "blocked" : exitCode === 0 ? (options.list ? "validated" : "passed") : "failed";
        let recording = { status: "not_required" };
        if (reportRequired && node_fs_1.default.existsSync(htmlReport) && executionStatus !== "blocked") {
            try {
                const recorded = (0, deliveryTestReport_1.appendDeliveryTestRun)({ projectRoot: options.projectRoot, engine: "pw", ...(scope.kind === "change" ? { change: scope.id } : { testingDir: `work/testing/${scope.id}` }), runId, runScope: runScope, result: executionStatus === "passed" ? "passed" : "failed", report: displayPath(options.projectRoot, htmlReport) });
                recording = { status: recorded.appended ? "recorded" : "already_recorded", file: recorded.file };
            }
            catch (error) {
                recording = { status: "failed", error: error instanceof Error ? error.message : String(error) };
            }
        }
        const metadataFile = node_path_1.default.join(output, "run-metadata.json");
        node_fs_1.default.writeFileSync(metadataFile, `${JSON.stringify({ version: 1, engine: "playwright", playwright_runtime_version: runtime.installedVersion, run_id: runId, scope: scope.kind === "simulation" ? "simulation" : scope.relativeTestingDirectory, integration: options.integration, environment: environmentName, contract_snapshot: contract, tests: tests.map((test) => displayPath(options.projectRoot, test)), grep: options.grep ?? null, projects: options.projects, workers: options.workers, list: options.list, reported_test_count: testCount ?? null, exit_code: exitCode, execution_status: executionStatus, report: node_fs_1.default.existsSync(htmlReport) ? displayPath(options.projectRoot, htmlReport) : null, structured_results: node_fs_1.default.existsSync(jsonReport) ? displayPath(options.projectRoot, jsonReport) : null, recording, completed_at: new Date().toISOString() }, null, 2)}\n`, "utf8");
        const ok = executionStatus === "passed" || executionStatus === "validated";
        console.log(JSON.stringify({ ok: ok && recording.status !== "failed", status: recording.status === "failed" ? "blocked" : executionStatus, exit_code: exitCode, run_id: runId, scope: scope.kind === "simulation" ? "simulation" : scope.relativeTestingDirectory, environment: environmentName, list: options.list, reported_test_count: testCount ?? null, output: displayPath(options.projectRoot, output), report: node_fs_1.default.existsSync(htmlReport) ? displayPath(options.projectRoot, htmlReport) : null, structured_results: node_fs_1.default.existsSync(jsonReport) ? displayPath(options.projectRoot, jsonReport) : null, metadata: displayPath(options.projectRoot, metadataFile), stdout_log: displayPath(options.projectRoot, stdoutLog), stderr_log: displayPath(options.projectRoot, stderrLog), contract_alignment: contract.alignment, recording, ...(result.error ? { error: result.error.message } : {}), next_step: ok ? (reportRequired ? "The run is recorded. Update executed test-case states." : "Continue with the intended PW flow; no log reading is required.") : executionStatus === "blocked" && testCount === 0 ? "No tests matched the selected path, mode project, or grep. Fix the selection before recording a Test Run." : "Read the HTML report and trace first; inspect only relevant log fragments when needed." }));
        return ok && recording.status !== "failed" ? 0 : 1;
    }
    catch (error) {
        return compactFailure(error instanceof Error ? error.message : String(error));
    }
}
exports.playwrightTestRunTool = {
    name: "playwright_test_run",
    run: async (args, context) => {
        const rest = [...args];
        const integration = (0, args_1.consumeOption)(rest, "--integration");
        const change = (0, args_1.consumeOption)(rest, "--change");
        const testingDir = (0, args_1.consumeOption)(rest, "--testing-dir");
        const tests = (0, args_1.consumeRepeatedOption)(rest, "--test");
        const projects = (0, args_1.consumeRepeatedOption)(rest, "--project");
        const grep = (0, args_1.consumeOption)(rest, "--grep");
        const environment = (0, args_1.consumeOption)(rest, "--environment");
        const workersValue = (0, args_1.consumeOption)(rest, "--workers");
        const runId = (0, args_1.consumeOption)(rest, "--run-id");
        const runScope = (0, args_1.consumeOption)(rest, "--scope");
        const simulationAt = rest.indexOf("--simulation");
        const simulation = simulationAt >= 0;
        if (simulation)
            rest.splice(simulationAt, 1);
        const listAt = rest.indexOf("--list");
        const list = listAt >= 0;
        if (list)
            rest.splice(listAt, 1);
        if (rest.length)
            throw new Error(`Unknown playwright_test_run arguments: ${rest.join(" ")}`);
        return runPlaywrightTest({ projectRoot: context.projectRoot, integration: requiredText(integration, "--integration"), change, testingDir, simulation, tests, grep, projects, environment, workers: workersValue === undefined ? 1 : Number(workersValue), runId, runScope, list });
    },
};
