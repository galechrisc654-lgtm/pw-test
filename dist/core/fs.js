"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureDir = ensureDir;
exports.readText = readText;
exports.writeText = writeText;
exports.readJson = readJson;
exports.listFilesRecursive = listFilesRecursive;
exports.copyDirectory = copyDirectory;
exports.writeManagedFile = writeManagedFile;
exports.nextNewFilePath = nextNewFilePath;
exports.appendGitignoreEntry = appendGitignoreEntry;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
function ensureDir(dir) {
    node_fs_1.default.mkdirSync(dir, { recursive: true });
}
function readText(file) {
    return node_fs_1.default.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
}
function writeText(file, content) {
    ensureDir(node_path_1.default.dirname(file));
    node_fs_1.default.writeFileSync(file, content, "utf8");
}
function readJson(file, required) {
    if (!node_fs_1.default.existsSync(file)) {
        if (required) {
            throw new Error(`Required JSON file not found: ${file}`);
        }
        return {};
    }
    const parsed = JSON.parse(readText(file));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error(`JSON file must contain an object: ${file}`);
    }
    return parsed;
}
function listFilesRecursive(root) {
    if (!node_fs_1.default.existsSync(root)) {
        return [];
    }
    const results = [];
    for (const entry of node_fs_1.default.readdirSync(root, { withFileTypes: true })) {
        const fullPath = node_path_1.default.join(root, entry.name);
        if (entry.isDirectory()) {
            results.push(...listFilesRecursive(fullPath));
        }
        else if (entry.isFile()) {
            results.push(fullPath);
        }
    }
    return results;
}
function copyDirectory(source, target, mode) {
    const actions = [];
    ensureDir(target);
    for (const sourceFile of listFilesRecursive(source)) {
        const relative = node_path_1.default.relative(source, sourceFile);
        const targetFile = node_path_1.default.join(target, relative);
        actions.push(writeManagedFile(targetFile, readText(sourceFile), mode));
    }
    return actions;
}
function writeManagedFile(targetFile, content, mode) {
    if (!node_fs_1.default.existsSync(targetFile)) {
        writeText(targetFile, content);
        return { action: "created", path: targetFile };
    }
    if (mode === "overwrite") {
        writeText(targetFile, content);
        return { action: "updated", path: targetFile };
    }
    if (mode === "new") {
        const newPath = nextNewFilePath(targetFile);
        writeText(newPath, content);
        return { action: "new_file", path: newPath };
    }
    return { action: "skipped", path: targetFile };
}
function nextNewFilePath(targetFile) {
    const base = `${targetFile}.new`;
    if (!node_fs_1.default.existsSync(base)) {
        return base;
    }
    let index = 1;
    while (true) {
        const candidate = `${base}.${index}`;
        if (!node_fs_1.default.existsSync(candidate)) {
            return candidate;
        }
        index += 1;
    }
}
function appendGitignoreEntry(projectRoot, entry) {
    const file = node_path_1.default.join(projectRoot, ".gitignore");
    const existing = node_fs_1.default.existsSync(file) ? readText(file) : "";
    const lines = existing.split(/\r?\n/).map((line) => line.trim());
    if (lines.includes(entry)) {
        return { action: "skipped", path: file };
    }
    const prefix = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
    writeText(file, `${existing}${prefix}${entry}\n`);
    return { action: node_fs_1.default.existsSync(file) && existing.length > 0 ? "updated" : "created", path: file };
}
