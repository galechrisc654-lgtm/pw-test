"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectGitignoreEntries = void 0;
exports.appendProjectGitignoreEntries = appendProjectGitignoreEntries;
exports.listTrackedNonProjectAssets = listTrackedNonProjectAssets;
const node_child_process_1 = require("node:child_process");
const node_path_1 = __importDefault(require("node:path"));
const fs_1 = require("./fs");
exports.projectGitignoreEntries = [
    "references/integrations/secrets.local.json",
    "_aiprod/",
    ".aiprod-local/",
    ".codex/",
    ".karate-poc/",
];
const gitTrackedCheckPaths = [
    "references/integrations/secrets.local.json",
    "_aiprod",
    "aiprod.cmd",
    "aiprod.ps1",
    "aiprod",
    ".aiprod-local",
    ".codex",
    ".karate-poc",
];
function appendProjectGitignoreEntries(projectRoot) {
    return exports.projectGitignoreEntries.map((entry) => (0, fs_1.appendGitignoreEntry)(projectRoot, entry));
}
function listTrackedNonProjectAssets(projectRoot) {
    const result = (0, node_child_process_1.spawnSync)("git", ["-C", projectRoot, "ls-files", "--", ...gitTrackedCheckPaths], {
        cwd: projectRoot,
        encoding: "utf8",
        windowsHide: true,
    });
    if (result.status !== 0) {
        return [];
    }
    return result.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((item) => item.split(node_path_1.default.sep).join("/"));
}
