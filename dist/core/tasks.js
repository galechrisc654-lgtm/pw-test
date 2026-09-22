"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listWorkspaceTasks = listWorkspaceTasks;
exports.getWorkspaceTask = getWorkspaceTask;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const fs_1 = require("./fs");
function cleanFrontMatterValue(value) {
    return value.trim().replace(/^['"]|['"]$/g, "");
}
function frontMatterValue(frontMatter, key) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const line = frontMatter.find((item) => new RegExp(`^\\s*${escaped}\\s*:`).test(item));
    if (!line)
        return null;
    const value = line.replace(new RegExp(`^\\s*${escaped}\\s*:\\s*`), "");
    return cleanFrontMatterValue(value) || null;
}
function frontMatterList(frontMatter, key) {
    const inline = frontMatterValue(frontMatter, key);
    if (inline?.startsWith("[") && inline.endsWith("]")) {
        return inline.slice(1, -1).split(",").map(cleanFrontMatterValue).filter(Boolean);
    }
    if (inline && inline !== "[]")
        return [inline];
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const start = frontMatter.findIndex((item) => new RegExp(`^\\s*${escaped}\\s*:\\s*$`).test(item));
    if (start < 0)
        return [];
    const values = [];
    for (let index = start + 1; index < frontMatter.length; index += 1) {
        const line = frontMatter[index];
        if (/^\S[^:]*\s*:/.test(line))
            break;
        const match = line.match(/^\s*-\s*(.+?)\s*$/);
        if (match)
            values.push(cleanFrontMatterValue(match[1]));
    }
    return values.filter(Boolean);
}
function descriptionSummary(lines, frontMatterEnd) {
    const body = lines.slice(frontMatterEnd + 1);
    const descriptionIndex = body.findIndex((line) => /^##\s+Description\s*$/i.test(line.trim()));
    const source = descriptionIndex >= 0 ? body.slice(descriptionIndex + 1) : body;
    const collected = [];
    for (const line of source) {
        if (descriptionIndex >= 0 && /^##\s+/.test(line.trim()))
            break;
        const cleaned = line.replace(/^#+\s*/, "").replace(/<!--.*?-->/g, "").trim();
        if (cleaned)
            collected.push(cleaned);
        if (collected.join(" ").length > 180)
            break;
    }
    const text = collected.join(" ").replace(/\s+/g, " ").trim();
    return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}
function listWorkspaceTasks(projectRoot) {
    const tasksDir = node_path_1.default.join(projectRoot, "work", "tasks");
    if (!node_fs_1.default.existsSync(tasksDir))
        return [];
    const tasks = [];
    for (const entry of node_fs_1.default.readdirSync(tasksDir)) {
        if (!entry.endsWith(".md"))
            continue;
        const file = node_path_1.default.join(tasksDir, entry);
        const content = (0, fs_1.readText)(file).replace(/^\uFEFF/, "");
        const lines = content.split(/\r?\n/);
        if (lines[0] !== "---")
            continue;
        const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
        if (end < 0)
            continue;
        const frontMatter = lines.slice(1, end);
        const id = frontMatterValue(frontMatter, "id");
        const status = frontMatterValue(frontMatter, "status");
        if (!id || !status)
            continue;
        tasks.push({
            id,
            status,
            taskType: frontMatterValue(frontMatter, "task_type"),
            skill: frontMatterValue(frontMatter, "skill"),
            routine: frontMatterValue(frontMatter, "routine"),
            relatedUserRequests: frontMatterList(frontMatter, "related_user_requests"),
            relatedDiscoveries: frontMatterList(frontMatter, "related_discoveries"),
            relatedProductChanges: frontMatterList(frontMatter, "related_product_changes"),
            relatedFeatures: frontMatterList(frontMatter, "related_features"),
            relatedFiles: frontMatterList(frontMatter, "related_files"),
            description: descriptionSummary(lines, end),
            file: node_path_1.default.relative(projectRoot, file),
            content,
        });
    }
    return tasks.sort((a, b) => b.id.localeCompare(a.id));
}
function getWorkspaceTask(projectRoot, taskId) {
    const matches = listWorkspaceTasks(projectRoot).filter((task) => task.id === taskId);
    if (matches.length === 0)
        throw new Error(`Task not found: ${taskId}`);
    if (matches.length > 1)
        throw new Error(`Multiple tasks found for id ${taskId}: ${matches.map((task) => task.file).join(", ")}`);
    return matches[0];
}
