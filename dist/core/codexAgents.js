"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.codexAgentPaths = exports.codexAgentNames = void 0;
exports.installCodexAgents = installCodexAgents;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const fs_1 = require("./fs");
const paths_1 = require("./paths");
exports.codexAgentNames = ["aiprod_test_case_producer", "aiprod_test_case_reviewer"];
exports.codexAgentPaths = exports.codexAgentNames.map((name) => `.codex/agents/${name}.toml`);
const managedMarker = "# AIProd-managed Codex agent:";
function installCodexAgents(projectRoot) {
    const actions = [];
    const conflicts = [];
    for (const [index, name] of exports.codexAgentNames.entries()) {
        const relative = exports.codexAgentPaths[index];
        const target = node_path_1.default.join(projectRoot, relative);
        const content = (0, fs_1.readText)(node_path_1.default.join((0, paths_1.frameworkAiprodDir)(), "adapters/codex/agents", `${name}.toml`));
        if (node_fs_1.default.existsSync(target)) {
            if (!node_fs_1.default.lstatSync(target).isFile() || (0, fs_1.readText)(target).split(/\r?\n/, 1)[0] !== `${managedMarker} ${name}`) {
                conflicts.push(relative);
                actions.push({ action: "skipped", path: target });
                continue;
            }
            if ((0, fs_1.readText)(target) === content) {
                actions.push({ action: "skipped", path: target });
                continue;
            }
        }
        actions.push((0, fs_1.writeManagedFile)(target, content, "overwrite"));
    }
    return { actions, conflicts };
}
