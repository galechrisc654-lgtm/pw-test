"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskStatusUpdaterTool = void 0;
exports.runTaskStatusUpdater = runTaskStatusUpdater;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const fs_1 = require("../core/fs");
function runTaskStatusUpdater(options) {
    try {
        if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(options.status)) {
            throw new Error(`Invalid status value: ${options.status}`);
        }
        const tasksDir = node_path_1.default.join(options.projectRoot, "work", "tasks");
        if (!node_fs_1.default.existsSync(tasksDir))
            throw new Error(`Tasks directory not found: ${tasksDir}`);
        const matches = [];
        for (const entry of node_fs_1.default.readdirSync(tasksDir)) {
            if (!entry.endsWith(".md"))
                continue;
            const file = node_path_1.default.join(tasksDir, entry);
            const text = (0, fs_1.readText)(file);
            const lines = text.split(/\r?\n/);
            if (lines[0]?.replace(/^\uFEFF/, "") !== "---")
                continue;
            const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
            if (end < 0)
                continue;
            const frontMatter = lines.slice(1, end);
            const id = frontMatter.find((line) => /^\s*id\s*:/.test(line))?.replace(/^\s*id\s*:\s*/, "").trim().replace(/^['"]|['"]$/g, "");
            const status = frontMatter.find((line) => /^\s*status\s*:/.test(line))?.replace(/^\s*status\s*:\s*/, "").trim().replace(/^['"]|['"]$/g, "");
            if (id === options.taskId && status)
                matches.push({ file, text, oldStatus: status });
        }
        if (matches.length === 0)
            throw new Error(`Task not found: ${options.taskId}`);
        if (matches.length > 1)
            throw new Error(`Multiple tasks found for id ${options.taskId}: ${matches.map((item) => item.file).join(", ")}`);
        const match = matches[0];
        const changed = match.oldStatus !== options.status;
        if (changed && !options.dryRun) {
            const updated = match.text.replace(/^(\s*status\s*:\s*).*$/m, `$1${options.status}`);
            (0, fs_1.writeText)(match.file, updated);
        }
        console.log(JSON.stringify({
            ok: true,
            task_id: options.taskId,
            file: node_path_1.default.relative(options.projectRoot, match.file),
            old_status: match.oldStatus,
            new_status: options.status,
            changed,
            dry_run: options.dryRun,
        }, null, 2));
        return 0;
    }
    catch (error) {
        console.log(JSON.stringify({
            ok: false,
            task_id: options.taskId,
            new_status: options.status,
            dry_run: options.dryRun,
            error: error instanceof Error ? error.message : String(error),
        }, null, 2));
        return 1;
    }
}
exports.taskStatusUpdaterTool = {
    name: "task_status_updater",
    run: async (args, context) => {
        const dryRun = args.includes("--dry-run");
        const filtered = args.filter((arg) => arg !== "--dry-run");
        const [taskId, status, ...unknown] = filtered;
        if (!taskId || !status)
            throw new Error("task_status_updater requires task_id and status");
        if (unknown.length > 0)
            throw new Error(`Unknown task_status_updater arguments: ${unknown.join(" ")}`);
        return runTaskStatusUpdater({ taskId, status, projectRoot: context.projectRoot, dryRun });
    },
};
