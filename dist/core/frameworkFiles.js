"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.copyFrameworkPayload = copyFrameworkPayload;
exports.listUnexpectedFrameworkFiles = listUnexpectedFrameworkFiles;
const node_path_1 = __importDefault(require("node:path"));
const fs_1 = require("./fs");
const paths_1 = require("./paths");
const allowedProjectFrameworkFiles = new Set([
    "_aiprod/runtime/aiprod-cli.json",
    "_aiprod/runtime/aiprod-launcher.cjs",
]);
function normalizeRelative(value) {
    return value.split(node_path_1.default.sep).join("/");
}
function listPayloadFiles() {
    const sourceRoot = (0, paths_1.frameworkAiprodDir)();
    return (0, fs_1.listFilesRecursive)(sourceRoot).filter((file) => !normalizeRelative(node_path_1.default.relative(sourceRoot, file)).startsWith("adapters/codex/agents/"));
}
function copyFrameworkPayload(projectRoot, mode) {
    const targetRoot = node_path_1.default.join(projectRoot, "_aiprod");
    (0, fs_1.ensureDir)(targetRoot);
    return listPayloadFiles().map((source) => (0, fs_1.writeManagedFile)(node_path_1.default.join(targetRoot, node_path_1.default.relative((0, paths_1.frameworkAiprodDir)(), source)), (0, fs_1.readText)(source), mode));
}
function listUnexpectedFrameworkFiles(projectRoot) {
    const sourceRoot = (0, paths_1.frameworkAiprodDir)();
    const projectAiprodRoot = node_path_1.default.join(projectRoot, "_aiprod");
    const expected = new Set(listPayloadFiles().map((file) => `_aiprod/${normalizeRelative(node_path_1.default.relative(sourceRoot, file))}`));
    for (const file of allowedProjectFrameworkFiles) {
        expected.add(file);
    }
    return (0, fs_1.listFilesRecursive)(projectAiprodRoot)
        .map((file) => normalizeRelative(node_path_1.default.relative(projectRoot, file)))
        .filter((file) => !expected.has(file))
        .sort();
}
