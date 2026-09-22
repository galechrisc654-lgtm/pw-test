"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentRunLoggerTool = void 0;
exports.runAgentRunLogger = runAgentRunLogger;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const fs_1 = require("../core/fs");
const args_1 = require("./args");
const AGENT_RUN_CHANGE_TYPES = new Set(["created", "modified", "moved", "renamed", "deleted"]);
function pad(value, length) {
    return String(value).padStart(length, "0");
}
function agentRunTimestamp(date) {
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1, 2);
    const day = pad(date.getDate(), 2);
    const hour = pad(date.getHours(), 2);
    const minute = pad(date.getMinutes(), 2);
    const second = pad(date.getSeconds(), 2);
    const ms = pad(date.getMilliseconds(), 3);
    return {
        idStamp: `${year}${month}${day}-${hour}${minute}${second}-${ms}`,
        month: `${year}-${month}`,
    };
}
function taskExists(projectRoot, taskId) {
    const tasksDir = node_path_1.default.join(projectRoot, "work", "tasks");
    if (!node_fs_1.default.existsSync(tasksDir))
        return false;
    for (const entry of node_fs_1.default.readdirSync(tasksDir)) {
        if (!entry.endsWith(".md"))
            continue;
        const text = (0, fs_1.readText)(node_path_1.default.join(tasksDir, entry));
        const lines = text.split(/\r?\n/);
        if (lines[0]?.replace(/^\uFEFF/, "") !== "---")
            continue;
        const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
        if (end < 0)
            continue;
        const id = lines
            .slice(1, end)
            .find((line) => /^\s*id\s*:/.test(line))
            ?.replace(/^\s*id\s*:\s*/, "")
            .trim()
            .replace(/^['"]|['"]$/g, "");
        if (id === taskId)
            return true;
    }
    return false;
}
function validateAgentRunOptions(options) {
    if (!/^TASK-\d{8}-[A-Za-z0-9_-]+$/.test(options.taskId)) {
        throw new Error(`Invalid task id: ${options.taskId}`);
    }
    if (!options.summary.trim()) {
        throw new Error("summary is required");
    }
    if (!taskExists(options.projectRoot, options.taskId)) {
        throw new Error(`Task not found: ${options.taskId}`);
    }
    for (const change of options.fileChanges) {
        if (!change.path || typeof change.path !== "string") {
            throw new Error("file_changes[].path is required");
        }
        if (!AGENT_RUN_CHANGE_TYPES.has(change.change_type)) {
            throw new Error(`Invalid file change type for ${change.path}: ${change.change_type}`);
        }
        if (node_path_1.default.isAbsolute(change.path)) {
            throw new Error(`file change path must be project-relative: ${change.path}`);
        }
    }
}
function runAgentRunLogger(options) {
    try {
        validateAgentRunOptions(options);
        const timestamp = agentRunTimestamp(new Date());
        const record = {
            id: `AR-${timestamp.idStamp}`,
            task: options.taskId,
            file_changes: options.fileChanges,
            summary: options.summary.trim(),
            issues: options.issues,
        };
        const logDir = node_path_1.default.join(options.projectRoot, "work", "agent_runs");
        const logFile = node_path_1.default.join(logDir, `${timestamp.month}.jsonl`);
        if (!options.dryRun) {
            node_fs_1.default.mkdirSync(logDir, { recursive: true });
            node_fs_1.default.appendFileSync(logFile, `${JSON.stringify(record)}\n`, "utf8");
        }
        console.log(JSON.stringify({
            ok: true,
            dry_run: options.dryRun,
            file: node_path_1.default.relative(options.projectRoot, logFile),
            record,
        }, null, 2));
        return 0;
    }
    catch (error) {
        console.log(JSON.stringify({
            ok: false,
            task: options.taskId,
            dry_run: options.dryRun,
            error: error instanceof Error ? error.message : String(error),
        }, null, 2));
        return 1;
    }
}
function parseFileChange(value) {
    if (!value.trim().startsWith("{")) {
        const [filePath, changeType, ...summaryParts] = value.split("|");
        if (!filePath || !changeType) {
            throw new Error("--file-change requires JSON or path|change_type|summary");
        }
        const result = {
            path: filePath,
            change_type: changeType,
        };
        const summary = summaryParts.join("|").trim();
        if (summary)
            result.summary = summary;
        return result;
    }
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("--file-change must be a JSON object");
    }
    const item = parsed;
    if (typeof item.path !== "string" || typeof item.change_type !== "string") {
        throw new Error("--file-change requires path and change_type");
    }
    const result = {
        path: item.path,
        change_type: item.change_type,
    };
    if (typeof item.summary === "string")
        result.summary = item.summary;
    return result;
}
exports.agentRunLoggerTool = {
    name: "agent_run_logger",
    run: async (args, context) => {
        const dryRun = args.includes("--dry-run");
        const filtered = args.filter((arg) => arg !== "--dry-run");
        const taskId = (0, args_1.consumeOption)(filtered, "--task") ?? filtered[0];
        const summary = (0, args_1.consumeOption)(filtered, "--summary");
        const fileChanges = (0, args_1.consumeRepeatedOption)(filtered, "--file-change").map(parseFileChange);
        const issues = (0, args_1.consumeRepeatedOption)(filtered, "--issue");
        if (!taskId || !summary)
            throw new Error("agent_run_logger requires --task <task_id> and --summary <text>");
        if (filtered.length > 0 && filtered[0] === taskId)
            filtered.shift();
        if (filtered.length > 0)
            throw new Error(`Unknown agent_run_logger arguments: ${filtered.join(" ")}`);
        return runAgentRunLogger({ taskId, summary, fileChanges, issues, projectRoot: context.projectRoot, dryRun });
    },
};
