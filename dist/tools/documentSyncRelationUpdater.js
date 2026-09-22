"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.documentSyncRelationUpdaterTool = void 0;
exports.runDocumentSyncRelationUpdater = runDocumentSyncRelationUpdater;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const fs_1 = require("../core/fs");
const args_1 = require("./args");
const RELATIONS_FILE = node_path_1.default.join("work", "document_sync", "relations.json");
const PARENT_TYPES = new Set(["folder", "wiki_node"]);
function required(value, name) {
    if (!value?.trim())
        throw new Error(`${name} is required`);
    return value.trim();
}
function normalizeLocalPath(projectRoot, value) {
    const input = required(value, "--local-path").replace(/\\/g, "/");
    if (node_path_1.default.posix.isAbsolute(input))
        throw new Error("--local-path must be relative to the project root");
    const resolved = node_path_1.default.resolve(projectRoot, input);
    const relative = node_path_1.default.relative(projectRoot, resolved);
    if (!relative || relative === ".." || relative.startsWith(`..${node_path_1.default.sep}`) || node_path_1.default.isAbsolute(relative)) {
        throw new Error("--local-path must stay within the project root");
    }
    if (!node_fs_1.default.existsSync(resolved) || !node_fs_1.default.statSync(resolved).isFile()) {
        throw new Error(`Local document not found: ${input}`);
    }
    return relative.split(node_path_1.default.sep).join("/");
}
function requiredUrl(value, name) {
    const result = required(value, name);
    try {
        const url = new URL(result);
        if (url.protocol !== "https:")
            throw new Error();
    }
    catch {
        throw new Error(`${name} must be an https URL`);
    }
    return result;
}
function parentType(value) {
    const result = required(value, "--feishu-parent-type");
    if (!PARENT_TYPES.has(result)) {
        throw new Error("--feishu-parent-type must be folder or wiki_node");
    }
    return result;
}
function parseRelations(targetFile) {
    if (!node_fs_1.default.existsSync(targetFile))
        return { version: 1, relations: [] };
    let value;
    try {
        value = JSON.parse((0, fs_1.readText)(targetFile));
    }
    catch {
        throw new Error(`${RELATIONS_FILE.split(node_path_1.default.sep).join("/")} must contain valid JSON`);
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error(`${RELATIONS_FILE.split(node_path_1.default.sep).join("/")} must be a JSON object`);
    }
    const record = value;
    if (!Number.isInteger(record.version) || record.version <= 0 || !Array.isArray(record.relations)) {
        throw new Error(`${RELATIONS_FILE.split(node_path_1.default.sep).join("/")} must contain a positive version and relations array`);
    }
    return { version: record.version, relations: record.relations };
}
function runDocumentSyncRelationUpdater(options) {
    try {
        const relation = {
            local_path: normalizeLocalPath(options.projectRoot, options.local_path),
            sync_type: options.sync_type,
            feishu_title: required(options.feishu_title, "--feishu-title"),
            feishu_parent_type: parentType(options.feishu_parent_type),
            feishu_parent_token: required(options.feishu_parent_token, "--feishu-parent-token"),
            feishu_location: requiredUrl(options.feishu_location, "--feishu-location"),
            feishu_url: requiredUrl(options.feishu_url, "--feishu-url"),
            feishu_document_id: required(options.feishu_document_id, "--feishu-document-id"),
        };
        const targetFile = node_path_1.default.join(options.projectRoot, RELATIONS_FILE);
        const current = parseRelations(targetFile);
        const matchingIndexes = current.relations
            .map((item, index) => item.local_path === relation.local_path && item.sync_type === relation.sync_type ? index : -1)
            .filter((index) => index >= 0);
        if (matchingIndexes.length > 1) {
            throw new Error(`Multiple relations exist for ${relation.local_path} and sync type ${relation.sync_type ?? "null"}`);
        }
        const action = matchingIndexes.length === 1 ? "updated" : "created";
        const nextRelations = [...current.relations];
        if (matchingIndexes.length === 1)
            nextRelations[matchingIndexes[0]] = relation;
        else
            nextRelations.push(relation);
        if (!options.dryRun) {
            (0, fs_1.writeText)(targetFile, `${JSON.stringify({ version: current.version, relations: nextRelations }, null, 2)}\n`);
        }
        console.log(JSON.stringify({
            ok: true,
            dry_run: options.dryRun,
            action,
            file: RELATIONS_FILE.split(node_path_1.default.sep).join("/"),
            relation,
        }, null, 2));
        return 0;
    }
    catch (error) {
        console.log(JSON.stringify({
            ok: false,
            dry_run: options.dryRun,
            error: error instanceof Error ? error.message : String(error),
        }, null, 2));
        return 1;
    }
}
exports.documentSyncRelationUpdaterTool = {
    name: "document_sync_relation_updater",
    run: async (args, context) => {
        const dryRun = args.includes("--dry-run");
        const filtered = args.filter((arg) => arg !== "--dry-run");
        const localPath = (0, args_1.consumeOption)(filtered, "--local-path");
        const syncTypeValue = (0, args_1.consumeOption)(filtered, "--sync-type");
        const title = (0, args_1.consumeOption)(filtered, "--feishu-title");
        const parentTypeValue = (0, args_1.consumeOption)(filtered, "--feishu-parent-type");
        const parentToken = (0, args_1.consumeOption)(filtered, "--feishu-parent-token");
        const location = (0, args_1.consumeOption)(filtered, "--feishu-location");
        const url = (0, args_1.consumeOption)(filtered, "--feishu-url");
        const documentId = (0, args_1.consumeOption)(filtered, "--feishu-document-id");
        if (filtered.length > 0)
            throw new Error(`Unknown document_sync_relation_updater arguments: ${filtered.join(" ")}`);
        return runDocumentSyncRelationUpdater({
            local_path: required(localPath, "--local-path"),
            sync_type: syncTypeValue === "null" ? null : required(syncTypeValue, "--sync-type"),
            feishu_title: required(title, "--feishu-title"),
            feishu_parent_type: parentType(parentTypeValue),
            feishu_parent_token: required(parentToken, "--feishu-parent-token"),
            feishu_location: required(location, "--feishu-location"),
            feishu_url: required(url, "--feishu-url"),
            feishu_document_id: required(documentId, "--feishu-document-id"),
            projectRoot: context.projectRoot,
            dryRun,
        });
    },
};
