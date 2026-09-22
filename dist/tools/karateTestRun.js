"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.karateTestRunTool = void 0;
exports.runKarateTest = runKarateTest;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_child_process_1 = require("node:child_process");
const testContractSnapshot_1 = require("../core/testContractSnapshot");
const args_1 = require("./args");
const deliveryTestReport_1 = require("./deliveryTestReport");
const integrationResolver_1 = require("./integrationResolver");
function isRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function requiredText(value, name) {
    if (typeof value !== "string" || !value.trim())
        throw new Error(`${name} is required`);
    return value.trim();
}
function stableId(value, option) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(value))
        throw new Error(`${option} must be a single stable ID`);
    return value;
}
function projectPath(projectRoot, value, label) {
    const resolved = node_path_1.default.resolve(projectRoot, value);
    const relative = node_path_1.default.relative(projectRoot, resolved);
    if (!relative || relative.startsWith("..") || node_path_1.default.isAbsolute(relative)) {
        throw new Error(`${label} must be a path inside the project root: ${value}`);
    }
    return resolved;
}
function displayPath(projectRoot, value) {
    return node_path_1.default.relative(projectRoot, value).split(node_path_1.default.sep).join("/");
}
function assertReviewedTestCases(projectRoot, scope) {
    if (scope.kind === "simulation")
        return;
    const testingDirectory = node_path_1.default.join(projectRoot, ...scope.relativeTestingDirectory.split("/"));
    const file = node_path_1.default.join(testingDirectory, "test-cases.md");
    if (!node_fs_1.default.existsSync(file) || !node_fs_1.default.statSync(file).isFile())
        throw new Error(`Reviewed test cases not found: ${displayPath(projectRoot, file)}`);
    const document = node_fs_1.default.readFileSync(file, "utf8");
    if (!/^>\s*审核状态：\s*已审核\s*$/m.test(document))
        throw new Error(`${displayPath(projectRoot, file)} must be explicitly marked 审核状态：已审核 before Karate execution`);
}
function resolveScope(options) {
    const selected = Number(Boolean(options.change)) + Number(Boolean(options.testingDir)) + Number(options.simulation);
    if (selected !== 1)
        throw new Error("Provide exactly one of --change, --testing-dir or --simulation");
    if (options.change) {
        const id = stableId(options.change, "--change");
        return { kind: "change", id, relativeTestingDirectory: `changes/${id}/testing-ka` };
    }
    if (options.testingDir) {
        const normalized = options.testingDir.replace(/\\/g, "/").replace(/\/$/, "");
        const match = /^work\/testing\/([A-Za-z0-9][A-Za-z0-9_-]*)$/.exec(normalized);
        if (!match)
            throw new Error("--testing-dir must be work/testing/{test_id}");
        return { kind: "independent", id: match[1], relativeTestingDirectory: normalized };
    }
    return { kind: "simulation", id: "simulation", relativeTestingDirectory: null };
}
function defaultRunId() {
    const now = new Date();
    const date = [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((part) => String(part).padStart(2, "0")).join("");
    const time = [now.getHours(), now.getMinutes(), now.getSeconds()].map((part) => String(part).padStart(2, "0")).join("");
    return `TR-KA-${date}-${time}-${String(now.getMilliseconds()).padStart(3, "0")}`;
}
function findSummary(root) {
    if (!node_fs_1.default.existsSync(root))
        return undefined;
    const pending = [root];
    while (pending.length > 0) {
        const current = pending.shift();
        for (const entry of node_fs_1.default.readdirSync(current, { withFileTypes: true })) {
            const target = node_path_1.default.join(current, entry.name);
            if (entry.isFile() && entry.name === "karate-summary.html")
                return target;
            if (entry.isDirectory())
                pending.push(target);
        }
    }
    return undefined;
}
function runDirectory(projectRoot, scope, dryRun, runId) {
    const root = node_path_1.default.join(projectRoot, ".aiprod-local", "test-reports", "karate");
    if (scope.kind === "simulation")
        return node_path_1.default.join(root, "simulations", runId, "raw");
    const type = dryRun ? "dry-runs" : "runs";
    return scope.kind === "change"
        ? node_path_1.default.join(root, "changes", scope.id, type, runId, "raw")
        : node_path_1.default.join(root, "independent", scope.id, type, runId, "raw");
}
function compactFailure(message) {
    console.log(JSON.stringify({ ok: false, status: "blocked", error: message, next_step: "Fix the configuration error, then run karate_test_run again." }));
    return 1;
}
function runKarateTest(options) {
    try {
        const scope = resolveScope(options);
        assertReviewedTestCases(options.projectRoot, scope);
        if (options.profile && scope.kind !== "simulation")
            throw new Error("--profile is allowed only with --simulation");
        if (!Number.isInteger(options.threads) || options.threads < 1)
            throw new Error("--threads must be a positive integer");
        if (options.features.length === 0)
            throw new Error("At least one --feature is required");
        const resolved = (0, integrationResolver_1.resolveIntegration)({ id: options.integration, raw: true, projectRoot: options.projectRoot });
        if (resolved.adapter !== "karate-cli-ka")
            throw new Error(`Integration ${options.integration} must use adapter karate-cli-ka`);
        if (resolved.enabled !== true)
            throw new Error(`Integration is disabled: ${options.integration}`);
        const params = resolved.params;
        const javaPath = requiredText(params.java_path, "integration params.java_path");
        const karateJar = requiredText(params.karate_jar, "integration params.karate_jar");
        const environments = params.environments;
        if (!isRecord(environments))
            throw new Error("integration params.environments must be an object");
        const environmentName = options.environment ?? requiredText(params.default_environment, "integration params.default_environment");
        const targetEnvironment = environments[environmentName];
        if (!isRecord(targetEnvironment))
            throw new Error(`Environment not found in integration: ${environmentName}`);
        const contract = (0, testContractSnapshot_1.contractSnapshot)(options.projectRoot, targetEnvironment);
        const reportRequired = !options.dryRun && scope.kind !== "simulation";
        const runScope = reportRequired ? requiredText(options.runScope, "--scope") : undefined;
        if (reportRequired) {
            const testingDirectory = node_path_1.default.join(options.projectRoot, ...scope.relativeTestingDirectory.split("/"));
            for (const file of ["test-report.md", "test-runs.md"]) {
                const target = node_path_1.default.join(testingDirectory, file);
                if (!node_fs_1.default.existsSync(target) || !node_fs_1.default.statSync(target).isFile())
                    throw new Error(`Initialize the delivery test report before running Karate: ${displayPath(options.projectRoot, target)}`);
            }
        }
        const jarPath = node_path_1.default.isAbsolute(karateJar) ? karateJar : projectPath(options.projectRoot, karateJar, "karate_jar");
        if (!node_fs_1.default.existsSync(jarPath) || !node_fs_1.default.statSync(jarPath).isFile())
            throw new Error(`Karate JAR not found: ${jarPath}`);
        const configDir = node_path_1.default.join(options.projectRoot, "resources", "api_test_scenarios-ka", "config");
        if (!node_fs_1.default.existsSync(configDir) || !node_fs_1.default.statSync(configDir).isDirectory())
            throw new Error(`Karate config directory not found: ${configDir}`);
        const features = options.features.map((feature) => {
            const target = projectPath(options.projectRoot, feature, "feature");
            if (!node_fs_1.default.existsSync(target))
                throw new Error(`Feature path not found: ${target}`);
            return target;
        });
        const dataFile = options.dataFile ? projectPath(options.projectRoot, options.dataFile, "data file") : undefined;
        if (dataFile && (!node_fs_1.default.existsSync(dataFile) || !node_fs_1.default.statSync(dataFile).isFile()))
            throw new Error(`Data file not found: ${dataFile}`);
        const runId = stableId(options.runId ?? defaultRunId(), "--run-id");
        const outputDirectory = runDirectory(options.projectRoot, scope, options.dryRun, runId);
        if (node_fs_1.default.existsSync(outputDirectory))
            throw new Error(`Run output already exists: ${outputDirectory}`);
        node_fs_1.default.mkdirSync(outputDirectory, { recursive: true });
        const stdoutLog = node_path_1.default.join(outputDirectory, "karate-stdout.log");
        const stderrLog = node_path_1.default.join(outputDirectory, "karate-stderr.log");
        const childEnvironment = {
            ...process.env,
            AIPROD_KA_PROJECT_ROOT: options.projectRoot.replace(/\\/g, "/"),
            AIPROD_KA_ENV_JSON: JSON.stringify(targetEnvironment),
            ...(dataFile ? { AIPROD_KA_DATA_FILE: dataFile } : {}),
        };
        const commandArgs = [
            ...(options.profile ? [`-DprofileName=${options.profile}`] : []),
            "-jar",
            jarPath,
            "run",
            "--configdir",
            configDir,
            "--output",
            outputDirectory,
            "--threads",
            String(options.threads),
            ...options.tags.flatMap((tag) => ["--tags", tag]),
            ...(options.dryRun ? ["--dryrun"] : []),
            ...features,
        ];
        let result;
        const stdoutFd = node_fs_1.default.openSync(stdoutLog, "w");
        const stderrFd = node_fs_1.default.openSync(stderrLog, "w");
        try {
            result = (0, node_child_process_1.spawnSync)(javaPath, commandArgs, {
                cwd: options.projectRoot,
                env: childEnvironment,
                stdio: ["ignore", stdoutFd, stderrFd],
                windowsHide: true,
            });
        }
        finally {
            node_fs_1.default.closeSync(stdoutFd);
            node_fs_1.default.closeSync(stderrFd);
        }
        const exitCode = typeof result.status === "number" ? result.status : 1;
        const summary = findSummary(outputDirectory);
        const executionSucceeded = exitCode === 0 && !result.error && (!reportRequired || Boolean(summary));
        const executionStatus = result.error || (reportRequired && !summary)
            ? "blocked"
            : exitCode === 0 ? (options.dryRun ? "validated" : "passed") : "failed";
        let recording = { status: "not_required" };
        if (reportRequired && summary) {
            try {
                const recorded = (0, deliveryTestReport_1.appendDeliveryTestRun)({
                    projectRoot: options.projectRoot,
                    ...(scope.kind === "change" ? { change: scope.id } : { testingDir: scope.relativeTestingDirectory }),
                    runId,
                    runScope: runScope,
                    result: executionStatus === "passed" ? "passed" : "failed",
                    report: displayPath(options.projectRoot, summary),
                });
                recording = { status: recorded.appended ? "recorded" : "already_recorded", file: recorded.file };
            }
            catch (error) {
                recording = { status: "failed", error: error instanceof Error ? error.message : String(error) };
            }
        }
        const status = recording.status === "failed" ? "blocked" : executionStatus;
        const succeeded = executionSucceeded && recording.status !== "failed";
        const metadataFile = node_path_1.default.join(outputDirectory, "run-metadata.json");
        node_fs_1.default.writeFileSync(metadataFile, `${JSON.stringify({
            version: 1,
            run_id: runId,
            scope: scope.kind === "simulation" ? "simulation" : scope.relativeTestingDirectory,
            integration: options.integration,
            environment: environmentName,
            contract_snapshot: contract,
            features: features.map((feature) => displayPath(options.projectRoot, feature)),
            tags: options.tags,
            threads: options.threads,
            dry_run: options.dryRun,
            exit_code: exitCode,
            execution_status: executionStatus,
            report: summary ? displayPath(options.projectRoot, summary) : null,
            recording,
            completed_at: new Date().toISOString(),
        }, null, 2)}\n`, "utf8");
        console.log(JSON.stringify({
            ok: succeeded,
            status,
            exit_code: exitCode,
            run_id: runId,
            scope: scope.kind === "simulation" ? "simulation" : scope.relativeTestingDirectory,
            environment: environmentName,
            dry_run: options.dryRun,
            output: displayPath(options.projectRoot, outputDirectory),
            report: summary ? displayPath(options.projectRoot, summary) : null,
            metadata: displayPath(options.projectRoot, metadataFile),
            stdout_log: displayPath(options.projectRoot, stdoutLog),
            stderr_log: displayPath(options.projectRoot, stderrLog),
            contract_alignment: contract.alignment,
            recording,
            ...(result.error ? { error: result.error.message } : {}),
            next_step: succeeded
                ? (options.dryRun || scope.kind === "simulation" ? "Continue with the intended test flow; no log reading is required." : "The run is recorded. Update the executed test-case states; no log reading is required.")
                : recording.status === "failed"
                    ? "The Karate run finished but automatic Test Run recording failed. Repair the report entry with delivery_test_report append-test-run."
                    : summary
                        ? "Read the HTML report first. Inspect only the needed tail or matching lines from the log files if the report is insufficient."
                        : "No HTML summary was produced. Inspect only the needed tail or matching lines from the log files.",
        }));
        return succeeded ? 0 : 1;
    }
    catch (error) {
        return compactFailure(error instanceof Error ? error.message : String(error));
    }
}
exports.karateTestRunTool = {
    name: "karate_test_run",
    run: async (args, context) => {
        const rest = [...args];
        const integration = (0, args_1.consumeOption)(rest, "--integration");
        const change = (0, args_1.consumeOption)(rest, "--change");
        const testingDir = (0, args_1.consumeOption)(rest, "--testing-dir");
        const features = (0, args_1.consumeRepeatedOption)(rest, "--feature");
        const tags = (0, args_1.consumeRepeatedOption)(rest, "--tag");
        const environment = (0, args_1.consumeOption)(rest, "--environment");
        const threadsValue = (0, args_1.consumeOption)(rest, "--threads");
        const runId = (0, args_1.consumeOption)(rest, "--run-id");
        const dataFile = (0, args_1.consumeOption)(rest, "--data-file");
        const profile = (0, args_1.consumeOption)(rest, "--profile");
        const runScope = (0, args_1.consumeOption)(rest, "--scope");
        const simulationIndex = rest.indexOf("--simulation");
        const simulation = simulationIndex >= 0;
        if (simulation)
            rest.splice(simulationIndex, 1);
        const dryRunIndex = rest.indexOf("--dry-run");
        const dryRun = dryRunIndex >= 0;
        if (dryRun)
            rest.splice(dryRunIndex, 1);
        if (rest.length > 0)
            throw new Error(`Unknown karate_test_run arguments: ${rest.join(" ")}`);
        return runKarateTest({
            projectRoot: context.projectRoot,
            integration: requiredText(integration, "--integration"),
            change,
            testingDir,
            simulation,
            features,
            tags,
            environment,
            threads: threadsValue === undefined ? 1 : Number(threadsValue),
            runId,
            dataFile,
            profile,
            runScope,
            dryRun,
        });
    },
};
