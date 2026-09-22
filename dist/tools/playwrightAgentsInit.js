"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.playwrightAgentsInitTool = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_child_process_1 = require("node:child_process");
const playwrightRuntime_1 = require("../core/playwrightRuntime");
const args_1 = require("./args");
const integrationResolver_1 = require("./integrationResolver");
const MARKER = "AIProd Playwright governance overlay";
const AGENTS = ["planner", "generator", "healer"];
const OVERLAYS = {
    planner: `# ${MARKER}\n- Treat reviewed testing-pw/test-cases.md as the business expectation and do not expand its scope.\n- Plan only UI or hybrid behavior. In hybrid tests API may prepare or verify state, but must not replace the UI behavior under test.\n- Do not edit product files or approve test cases.\n`,
    generator: `# ${MARKER}\n- Generate only from the confirmed plan and reviewed testing-pw/test-cases.md.\n- Use .ui.spec.ts or .hybrid.spec.ts and export literal aiprod metadata with caseId, title, and matching mode.\n- Import test and expect from resources/api_test_scenarios-pw/support/test.ts when using AIProd environment or custom fixtures.\n- API may prepare or verify state but must not replace the UI behavior under test. Never expose credentials, tokens, cookies, or storage state.\n`,
    healer: `# ${MARKER}\n- Diagnose first. Modify tests only when evidence shows a locator, wait, fixture, or test-code defect.\n- Never relax reviewed expectations, change business meaning, replace UI behavior with API calls, or add test.skip/test.fixme to hide a product failure.\n- Product behavior differences must remain failing evidence for the AIProd BUG review flow. Stop instead of forcing a pass when these constraints apply.\n`,
};
function required(value, name) { if (typeof value !== "string" || !value.trim())
    throw new Error(`${name} is required`); return value.trim(); }
function officialOrManaged(file, name) {
    if (!node_fs_1.default.existsSync(file))
        return true;
    const content = node_fs_1.default.readFileSync(file, "utf8");
    return content.includes(`name = "playwright_test_${name}"`) && content.includes("[mcp_servers.playwright-test]");
}
function tomlString(value) { return JSON.stringify(value); }
function useSharedRuntime(file, cli, nodeModules, browsers) {
    const content = node_fs_1.default.readFileSync(file, "utf8");
    const header = "[mcp_servers.playwright-test]";
    const start = content.indexOf(header);
    if (start < 0)
        throw new Error(`Official agent is missing ${header}: ${file}`);
    const sectionEnd = content.indexOf("\n[", start + header.length);
    const end = sectionEnd < 0 ? content.length : sectionEnd;
    const section = content.slice(start, end);
    const lines = section.split(/\r?\n/).filter((line) => !/^\s*env\s*=/.test(line));
    let commandFound = false;
    let argsFound = false;
    const next = [];
    for (const line of lines) {
        if (/^\s*command\s*=/.test(line)) {
            next.push(`command = ${tomlString(process.execPath)}`);
            commandFound = true;
            continue;
        }
        if (/^\s*args\s*=/.test(line)) {
            next.push(`args = [${tomlString(cli)}, "run-test-mcp-server"]`);
            next.push(`env = { NODE_PATH = ${tomlString(nodeModules)}, PLAYWRIGHT_BROWSERS_PATH = ${tomlString(browsers)} }`);
            argsFound = true;
            continue;
        }
        next.push(line);
    }
    if (!commandFound || !argsFound)
        throw new Error(`Official agent has an unsupported MCP format: ${file}`);
    node_fs_1.default.writeFileSync(file, `${content.slice(0, start)}${next.join("\n")}${content.slice(end)}`, "utf8");
}
function addOverlay(file, overlay) {
    const content = node_fs_1.default.readFileSync(file, "utf8");
    if (content.includes(MARKER))
        return;
    const anchor = 'developer_instructions = """\n';
    const start = content.indexOf(anchor);
    const end = start < 0 ? -1 : content.indexOf('\n"""', start + anchor.length);
    if (start < 0 || end < 0)
        throw new Error(`Official agent has an unsupported format: ${file}`);
    node_fs_1.default.writeFileSync(file, `${content.slice(0, end)}\n\n${overlay}${content.slice(end)}`, "utf8");
}
function run(args, projectRoot) {
    const integration = required((0, args_1.consumeOption)(args, "--integration"), "--integration");
    if (args.length)
        throw new Error(`Unknown playwright_agents_init arguments: ${args.join(" ")}`);
    const resolved = (0, integrationResolver_1.resolveIntegration)({ id: integration, raw: true, projectRoot });
    if (resolved.adapter !== "playwright-cli-pw" || resolved.enabled !== true)
        throw new Error(`Integration ${integration} must be enabled and use adapter playwright-cli-pw`);
    const runtime = (0, playwrightRuntime_1.requirePlaywrightRuntime)();
    const agentProject = typeof resolved.params.agent_project === "string" && resolved.params.agent_project.trim() ? resolved.params.agent_project.trim() : "chromium";
    const cliPath = runtime.paths.cli;
    const agentDir = node_path_1.default.join(projectRoot, ".codex", "agents");
    for (const name of AGENTS) {
        const file = node_path_1.default.join(agentDir, `playwright_test_${name}.toml`);
        if (!officialOrManaged(file, name))
            throw new Error(`Refusing to replace a same-name custom Codex agent: ${node_path_1.default.relative(projectRoot, file)}`);
    }
    const runtimeEnvironment = (0, playwrightRuntime_1.playwrightRuntimeEnvironment)({ ...process.env, AIPROD_PW_PROJECT_ROOT: projectRoot.replace(/\\/g, "/") });
    const version = (0, node_child_process_1.spawnSync)(process.execPath, [cliPath, "--version"], { cwd: projectRoot, encoding: "utf8", env: runtimeEnvironment, windowsHide: true });
    if (version.status !== 0)
        throw new Error(`Unable to read Playwright version: ${(version.stderr || version.stdout).trim()}`);
    const configFile = node_path_1.default.join(projectRoot, "resources", "api_test_scenarios-pw", "config", "playwright.config.ts");
    if (!node_fs_1.default.existsSync(configFile))
        throw new Error(`Playwright config not found: ${configFile}`);
    const generated = (0, node_child_process_1.spawnSync)(process.execPath, [cliPath, "init-agents", "--loop=codex", "--config", configFile, "--project", agentProject], { cwd: projectRoot, env: runtimeEnvironment, encoding: "utf8", windowsHide: true });
    if (generated.status !== 0)
        throw new Error(`Playwright init-agents failed: ${(generated.stderr || generated.stdout).trim()}`);
    const files = [];
    for (const name of AGENTS) {
        const file = node_path_1.default.join(agentDir, `playwright_test_${name}.toml`);
        if (!node_fs_1.default.existsSync(file))
            throw new Error(`Playwright did not generate expected agent: ${file}`);
        addOverlay(file, OVERLAYS[name]);
        useSharedRuntime(file, cliPath, runtime.paths.nodeModules, runtime.paths.browsers);
        files.push(node_path_1.default.relative(projectRoot, file).split(node_path_1.default.sep).join("/"));
    }
    console.log(JSON.stringify({ ok: true, action: "playwright_agents_initialized", integration, playwright_version: version.stdout.trim(), agent_project: agentProject, agents: files, seed: node_fs_1.default.existsSync(node_path_1.default.join(projectRoot, "seed.spec.ts")) ? "seed.spec.ts" : null, governance_overlay: true }, null, 2));
    return 0;
}
exports.playwrightAgentsInitTool = {
    name: "playwright_agents_init",
    run: async (args, context) => { try {
        return run([...args], context.projectRoot);
    }
    catch (error) {
        console.log(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
        return 1;
    } },
};
