"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.playwrightRuntimeTool = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_child_process_1 = require("node:child_process");
const playwrightRuntime_1 = require("../core/playwrightRuntime");
const args_1 = require("./args");
function npmCli() {
    const candidates = [
        process.env.npm_execpath,
        node_path_1.default.join(node_path_1.default.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"),
        node_path_1.default.resolve(node_path_1.default.dirname(process.execPath), "..", "lib", "node_modules", "npm", "bin", "npm-cli.js"),
    ].filter((value) => Boolean(value));
    const found = candidates.find((candidate) => node_fs_1.default.existsSync(candidate));
    if (!found)
        throw new Error("npm CLI was not found beside the current Node runtime");
    return found;
}
function tail(value, limit = 3000) {
    const normalized = value.trim();
    return normalized.length <= limit ? normalized : normalized.slice(-limit);
}
function runInstall(args) {
    const requested = (0, args_1.consumeRepeatedOption)(args, "--browser");
    const noBrowserAt = args.indexOf("--no-browser");
    const noBrowser = noBrowserAt >= 0;
    if (noBrowser)
        args.splice(noBrowserAt, 1);
    if (args.length)
        throw new Error(`Unknown playwright_runtime install arguments: ${args.join(" ")}`);
    if (noBrowser && requested.length > 0)
        throw new Error("--no-browser cannot be combined with --browser");
    const browsers = (noBrowser ? [] : requested.length > 0 ? requested : ["chromium"]);
    for (const browser of browsers) {
        if (!playwrightRuntime_1.PLAYWRIGHT_BROWSERS.includes(browser))
            throw new Error(`Unsupported browser: ${browser}`);
    }
    const runtime = (0, playwrightRuntime_1.playwrightRuntimePaths)();
    node_fs_1.default.mkdirSync(runtime.root, { recursive: true });
    const manifest = {
        name: "@aiprod/playwright-runtime",
        private: true,
        version: "1.0.0",
        description: "AIProd-managed shared Playwright runtime. Do not add product test assets here.",
        devDependencies: { [playwrightRuntime_1.PLAYWRIGHT_RUNTIME_PACKAGE]: playwrightRuntime_1.PLAYWRIGHT_RUNTIME_VERSION },
    };
    node_fs_1.default.writeFileSync(node_path_1.default.join(runtime.root, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    const install = (0, node_child_process_1.spawnSync)(process.execPath, [npmCli(), "install", "--prefix", runtime.root, "--save-exact", "--no-audit", "--no-fund"], {
        encoding: "utf8",
        env: process.env,
        windowsHide: true,
    });
    if (install.status !== 0)
        throw new Error(`Unable to install ${playwrightRuntime_1.PLAYWRIGHT_RUNTIME_PACKAGE}@${playwrightRuntime_1.PLAYWRIGHT_RUNTIME_VERSION}: ${tail(install.stderr || install.stdout)}`);
    if (browsers.length > 0) {
        const browserInstall = (0, node_child_process_1.spawnSync)(process.execPath, [runtime.cli, "install", ...browsers], {
            encoding: "utf8",
            env: (0, playwrightRuntime_1.playwrightRuntimeEnvironment)(),
            windowsHide: true,
        });
        if (browserInstall.status !== 0)
            throw new Error(`Unable to install Playwright browser: ${tail(browserInstall.stderr || browserInstall.stdout)}`);
    }
    const status = (0, playwrightRuntime_1.getPlaywrightRuntimeStatus)();
    console.log(JSON.stringify({ ok: status.installed && browsers.every((browser) => status.browsers[browser].installed), action: "playwright_runtime_installed", runtime: status }, null, 2));
    return status.installed && browsers.every((browser) => status.browsers[browser].installed) ? 0 : 1;
}
function runStatus(args) {
    if (args.length)
        throw new Error(`Unknown playwright_runtime status arguments: ${args.join(" ")}`);
    const status = (0, playwrightRuntime_1.getPlaywrightRuntimeStatus)();
    console.log(JSON.stringify({ ok: status.installed, action: "playwright_runtime_status", runtime: status }, null, 2));
    return status.installed ? 0 : 1;
}
exports.playwrightRuntimeTool = {
    name: "playwright_runtime",
    run: async (args) => {
        const rest = [...args];
        const action = rest.shift();
        try {
            if (action === "install")
                return runInstall(rest);
            if (action === "status")
                return runStatus(rest);
            throw new Error("playwright_runtime requires install or status");
        }
        catch (error) {
            console.log(JSON.stringify({ ok: false, action: action ?? null, error: error instanceof Error ? error.message : String(error) }, null, 2));
            return 1;
        }
    },
};
