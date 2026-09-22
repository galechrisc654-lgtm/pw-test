"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startWebConsole = startWebConsole;
const node_child_process_1 = require("node:child_process");
const node_path_1 = __importDefault(require("node:path"));
const paths_1 = require("../core/paths");
const DEFAULT_WEB_PORT = 4173;
const DEFAULT_WEB_PREVIEW_PORT = 4174;
function parseMode(args) {
    if (args.includes("--start") || args.includes("--preview"))
        return "start";
    const index = args.indexOf("--mode");
    const raw = index >= 0 ? args[index + 1] : undefined;
    if (!raw)
        return "dev";
    if (raw === "dev" || raw === "start")
        return raw;
    throw new Error(`Invalid web mode: ${raw}`);
}
function parsePort(args, mode) {
    const index = args.indexOf("--port");
    const raw = index >= 0 ? args[index + 1] : undefined;
    const defaultPort = mode === "start" ? DEFAULT_WEB_PREVIEW_PORT : DEFAULT_WEB_PORT;
    const value = raw ? Number.parseInt(raw, 10) : defaultPort;
    if (!Number.isInteger(value) || value < 1 || value > 65535) {
        throw new Error(`Invalid port: ${raw}`);
    }
    return value;
}
function npmCommand() {
    return process.platform === "win32" ? "npm.cmd" : "npm";
}
function nextCommand(mode, port) {
    const script = mode === "start" ? "start" : "dev";
    if (process.platform === "win32") {
        return { command: "cmd.exe", args: ["/d", "/s", "/c", `npm run ${script} -- --port ${port}`] };
    }
    return { command: npmCommand(), args: ["run", script, "--", "--port", String(port)] };
}
function startWebConsole(args) {
    const mode = parseMode(args);
    const port = parsePort(args, mode);
    const webRoot = node_path_1.default.join((0, paths_1.aiprodRoot)(), "apps", "web");
    const command = nextCommand(mode, port);
    const child = (0, node_child_process_1.spawn)(command.command, command.args, {
        cwd: webRoot,
        env: process.env,
        stdio: "inherit",
        windowsHide: true,
    });
    child.on("close", (code) => {
        process.exitCode = code ?? 1;
    });
    child.on("error", (error) => {
        console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
        process.exitCode = 1;
    });
    return 0;
}
