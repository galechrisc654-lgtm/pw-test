"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.installProjectRuntime = installProjectRuntime;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const fs_1 = require("./fs");
const paths_1 = require("./paths");
function normalizeForNode(value) {
    return value.replace(/\\/g, "/");
}
function launcherScript() {
    return `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const childProcess = require("node:child_process");

const runtimeDir = __dirname;
const configPath = path.join(runtimeDir, "aiprod-cli.json");

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    console.error("AIProd runtime config not found. Run aiprod update <workspace_path> from the product workbench package.");
    process.exit(1);
  }
}

const config = readConfig();
const cliPath = config && typeof config.cli_js === "string" ? config.cli_js : "";

if (!cliPath || !fs.existsSync(cliPath)) {
  console.error("AIProd CLI path is not available for this project.");
  console.error("Run aiprod update <workspace_path> from the product workbench package to refresh the workspace runtime.");
  process.exit(1);
}

const result = childProcess.spawnSync(process.execPath, [cliPath, ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status === null ? 1 : result.status);
`;
}
function runtimeDir(projectRoot) {
    const root = node_path_1.default.resolve(projectRoot);
    const dir = node_path_1.default.resolve(root, "_aiprod", "runtime");
    if (dir !== node_path_1.default.join(root, "_aiprod", "runtime")) {
        throw new Error(`Invalid runtime directory: ${dir}`);
    }
    return dir;
}
function resetProjectRuntime(projectRoot) {
    const dir = runtimeDir(projectRoot);
    node_fs_1.default.rmSync(dir, { recursive: true, force: true });
    (0, fs_1.ensureDir)(dir);
}
function installProjectRuntime(projectRoot, cliEntry = "cli.js") {
    resetProjectRuntime(projectRoot);
    const cliJs = node_path_1.default.join((0, paths_1.aiprodRoot)(), "dist", cliEntry);
    const config = `${JSON.stringify({ cli_js: normalizeForNode(cliJs) }, null, 2)}\n`;
    return [
        (0, fs_1.writeManagedFile)(node_path_1.default.join(projectRoot, "_aiprod", "runtime", "aiprod-cli.json"), config, "overwrite"),
        (0, fs_1.writeManagedFile)(node_path_1.default.join(projectRoot, "_aiprod", "runtime", "aiprod-launcher.cjs"), launcherScript(), "overwrite"),
    ];
}
