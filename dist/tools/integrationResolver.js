"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.integrationResolverTool = void 0;
exports.resolveIntegration = resolveIntegration;
exports.runIntegrationResolver = runIntegrationResolver;
const node_path_1 = __importDefault(require("node:path"));
const fs_1 = require("../core/fs");
const VAR_PATTERN = /\$\{([^}:]+)(?::([^}]+))?\}/g;
const SENSITIVE_KEYWORDS = ["password", "token", "secret", "api_key", "apikey", "authorization", "credential"];
function isRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function deepMerge(base, overlay) {
    if (isRecord(base) && isRecord(overlay)) {
        const merged = { ...base };
        for (const [key, value] of Object.entries(overlay)) {
            merged[key] = deepMerge(merged[key], value);
        }
        return merged;
    }
    if (overlay === null || overlay === undefined) {
        return base;
    }
    return overlay;
}
function isSensitivePath(keyPath) {
    const joined = keyPath.join(".").toLowerCase();
    return SENSITIVE_KEYWORDS.some((keyword) => joined.includes(keyword));
}
function resolveIntegration(options) {
    const projectPath = node_path_1.default.join(options.projectRoot, "references", "integrations", "integrations.json");
    const localPath = node_path_1.default.join(options.projectRoot, "references", "integrations", "secrets.local.json");
    const project = (0, fs_1.readJson)(projectPath, true);
    const local = (0, fs_1.readJson)(localPath, false);
    const sensitiveFields = new Set();
    const warnings = [];
    const resolveVar = (kind, name, keyPath) => {
        if (kind === "env") {
            const value = process.env[name];
            if (value === undefined)
                throw new Error(`Environment variable not found: ${name}`);
            if (isSensitivePath(keyPath))
                sensitiveFields.add(keyPath.join("."));
            return options.raw || !isSensitivePath(keyPath) ? value : "***";
        }
        if (kind === "secret") {
            const secrets = isRecord(local.secrets) ? local.secrets : {};
            if (!(name in secrets))
                throw new Error(`Secret not found in ${localPath}: ${name}`);
            const value = secrets[name];
            sensitiveFields.add(keyPath.join("."));
            const resolved = typeof value === "string" ? resolveString(value, keyPath) : value;
            return options.raw ? resolved : "***";
        }
        if (kind === "local") {
            const locals = isRecord(local.locals) ? local.locals : {};
            if (!(name in locals))
                throw new Error(`Local value not found in ${localPath}: ${name}`);
            const value = locals[name];
            const resolved = typeof value === "string" ? resolveString(value, keyPath) : value;
            if (isSensitivePath(keyPath)) {
                sensitiveFields.add(keyPath.join("."));
                return options.raw ? resolved : "***";
            }
            return resolved;
        }
        if (kind === "project_root") {
            return options.projectRoot;
        }
        throw new Error(`Unsupported variable expression: ${kind}${name ? `:${name}` : ""}`);
    };
    const resolveString = (value, keyPath) => {
        const matches = [...value.matchAll(VAR_PATTERN)];
        if (matches.length === 0)
            return value;
        if (matches.length === 1 && matches[0].index === 0 && matches[0][0].length === value.length) {
            return resolveVar(matches[0][1] ?? "", matches[0][2] ?? "", keyPath);
        }
        return value.replace(VAR_PATTERN, (_full, kind, name) => {
            const replacement = resolveVar(kind, name ?? "", keyPath);
            return String(replacement);
        });
    };
    const resolveValue = (value, keyPath) => {
        if (Array.isArray(value))
            return value.map((item, index) => resolveValue(item, [...keyPath, String(index)]));
        if (isRecord(value)) {
            return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveValue(item, [...keyPath, key])]));
        }
        if (typeof value === "string") {
            const resolved = resolveString(value, keyPath);
            if (isSensitivePath(keyPath)) {
                sensitiveFields.add(keyPath.join("."));
                return options.raw ? resolved : "***";
            }
            return resolved;
        }
        return value;
    };
    let data;
    let adapter = null;
    let enabled = true;
    if (options.id === "defaults") {
        data = { params: isRecord(project.defaults) ? project.defaults : {} };
    }
    else {
        const integrations = isRecord(project.integrations) ? project.integrations : {};
        const localIntegrations = isRecord(local.integrations) ? local.integrations : {};
        const integration = integrations[options.id];
        if (!isRecord(integration))
            throw new Error(`Integration not found: ${options.id}`);
        const overlay = isRecord(localIntegrations[options.id]) ? localIntegrations[options.id] : {};
        data = deepMerge(integration, overlay);
        adapter = data.adapter;
        enabled = data.enabled ?? true;
        if (!adapter)
            throw new Error(`Integration missing adapter: ${options.id}`);
        if (!isRecord(data.params))
            throw new Error(`Integration params must be an object: ${options.id}`);
    }
    const resolved = resolveValue(data, ["integrations", options.id]);
    return {
        ok: true,
        id: options.id,
        adapter,
        enabled,
        raw: options.raw,
        params: isRecord(resolved.params) ? resolved.params : {},
        integration: options.id === "defaults" ? null : resolved,
        sensitive_fields: [...sensitiveFields].sort(),
        sources: {
            project: node_path_1.default.relative(options.projectRoot, projectPath),
            local: node_path_1.default.relative(options.projectRoot, localPath),
        },
        warnings,
    };
}
function runIntegrationResolver(options) {
    try {
        const output = resolveIntegration(options);
        console.log(JSON.stringify(output, null, 2));
        return 0;
    }
    catch (error) {
        console.log(JSON.stringify({ ok: false, id: options.id, raw: options.raw, error: error instanceof Error ? error.message : String(error) }, null, 2));
        return 1;
    }
}
exports.integrationResolverTool = {
    name: "integration_resolver",
    run: async (args, context) => {
        const raw = args.includes("--raw");
        const filtered = args.filter((arg) => arg !== "--raw");
        const id = filtered[0];
        if (!id)
            throw new Error("integration_resolver requires an id");
        if (filtered.length > 1)
            throw new Error(`Unknown integration_resolver arguments: ${filtered.slice(1).join(" ")}`);
        return runIntegrationResolver({ id, raw, projectRoot: context.projectRoot });
    },
};
