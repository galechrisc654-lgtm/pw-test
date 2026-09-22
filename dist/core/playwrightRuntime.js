"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAYWRIGHT_BROWSERS = exports.PLAYWRIGHT_RUNTIME_PACKAGE = exports.PLAYWRIGHT_RUNTIME_VERSION = void 0;
exports.playwrightRuntimePaths = playwrightRuntimePaths;
exports.playwrightRuntimeEnvironment = playwrightRuntimeEnvironment;
exports.getPlaywrightRuntimeStatus = getPlaywrightRuntimeStatus;
exports.requirePlaywrightRuntime = requirePlaywrightRuntime;
const node_fs_1 = __importDefault(require("node:fs"));
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const node_child_process_1 = require("node:child_process");
exports.PLAYWRIGHT_RUNTIME_VERSION = "1.63.0";
exports.PLAYWRIGHT_RUNTIME_PACKAGE = "@playwright/test";
exports.PLAYWRIGHT_BROWSERS = ["chromium", "firefox", "webkit"];
function userDataRoot() {
    if (process.env.AIPROD_USER_DATA_DIR)
        return node_path_1.default.resolve(process.env.AIPROD_USER_DATA_DIR);
    if (process.platform === "win32") {
        return node_path_1.default.join(process.env.LOCALAPPDATA || node_path_1.default.join(node_os_1.default.homedir(), "AppData", "Local"), "AIProd");
    }
    if (process.platform === "darwin")
        return node_path_1.default.join(node_os_1.default.homedir(), "Library", "Application Support", "AIProd");
    return node_path_1.default.join(process.env.XDG_DATA_HOME || node_path_1.default.join(node_os_1.default.homedir(), ".local", "share"), "aiprod");
}
function playwrightRuntimePaths() {
    const root = node_path_1.default.join(userDataRoot(), "runtimes", "playwright", exports.PLAYWRIGHT_RUNTIME_VERSION);
    const nodeModules = node_path_1.default.join(root, "node_modules");
    const packageRoot = node_path_1.default.join(nodeModules, "@playwright", "test");
    return {
        root,
        nodeModules,
        packageRoot,
        packageFile: node_path_1.default.join(packageRoot, "package.json"),
        cli: node_path_1.default.join(packageRoot, "cli.js"),
        browsers: node_path_1.default.join(root, "browsers"),
    };
}
function playwrightRuntimeEnvironment(base = process.env) {
    const runtime = playwrightRuntimePaths();
    return {
        ...base,
        NODE_PATH: [runtime.nodeModules, base.NODE_PATH].filter(Boolean).join(node_path_1.default.delimiter),
        PLAYWRIGHT_BROWSERS_PATH: runtime.browsers,
    };
}
function installedVersion(paths) {
    if (!node_fs_1.default.existsSync(paths.packageFile))
        return null;
    try {
        const value = JSON.parse(node_fs_1.default.readFileSync(paths.packageFile, "utf8"));
        return typeof value.version === "string" ? value.version : null;
    }
    catch {
        return null;
    }
}
function browserExecutable(paths, browser) {
    if (!node_fs_1.default.existsSync(paths.packageFile))
        return null;
    const script = "const api=require(process.argv[1]);process.stdout.write(api[process.argv[2]].executablePath())";
    const result = (0, node_child_process_1.spawnSync)(process.execPath, ["-e", script, paths.packageRoot, browser], {
        encoding: "utf8",
        env: playwrightRuntimeEnvironment(),
        windowsHide: true,
    });
    const executable = result.status === 0 ? result.stdout.trim() : "";
    return executable && node_fs_1.default.existsSync(executable) ? executable : null;
}
function getPlaywrightRuntimeStatus() {
    const paths = playwrightRuntimePaths();
    const version = installedVersion(paths);
    return {
        installed: version === exports.PLAYWRIGHT_RUNTIME_VERSION && node_fs_1.default.existsSync(paths.cli),
        expectedVersion: exports.PLAYWRIGHT_RUNTIME_VERSION,
        installedVersion: version,
        paths,
        browsers: Object.fromEntries(exports.PLAYWRIGHT_BROWSERS.map((browser) => {
            const executable = browserExecutable(paths, browser);
            return [browser, { installed: Boolean(executable), executable }];
        })),
    };
}
function requirePlaywrightRuntime() {
    const status = getPlaywrightRuntimeStatus();
    if (!status.installed) {
        throw new Error(`AIProd shared Playwright runtime ${status.expectedVersion} is not installed. Run: aiprod run playwright_runtime install --project-root .`);
    }
    return status;
}
