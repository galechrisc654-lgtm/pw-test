"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiContractRegistryTool = void 0;
exports.runApiContractRegistry = runApiContractRegistry;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const openapi_1 = require("../core/openapi");
const args_1 = require("./args");
const apiContractVerification_1 = require("./apiContractVerification");
function targetPath(projectRoot, value, label) {
    if (!value)
        throw new Error(`${label} is required`);
    const resolved = node_path_1.default.resolve(projectRoot, value);
    const relative = node_path_1.default.relative(projectRoot, resolved);
    if (relative.startsWith("..") || node_path_1.default.isAbsolute(relative))
        throw new Error(`${label} must stay inside project root: ${value}`);
    return resolved;
}
function readJson(file, label) {
    try {
        return JSON.parse(node_fs_1.default.readFileSync(file, "utf8"));
    }
    catch (error) {
        throw new Error(`Cannot read ${label}: ${error instanceof Error ? error.message : String(error)}`);
    }
}
function writeAtomic(file, content) {
    node_fs_1.default.mkdirSync(node_path_1.default.dirname(file), { recursive: true });
    const temporary = `${file}.tmp-${process.pid}`;
    node_fs_1.default.writeFileSync(temporary, content, "utf8");
    node_fs_1.default.renameSync(temporary, file);
}
function validateCatalog(catalog) {
    if (!catalog || typeof catalog !== "object" || !Array.isArray(catalog.operations))
        throw new Error("Invalid OpenAPI operation catalog");
    if (!catalog.service || !catalog.environment || !catalog.document_sha256)
        throw new Error("Catalog is missing service, environment, or document_sha256");
    const keys = new Set();
    for (const operation of catalog.operations) {
        if (!operation.key || !operation.method || !operation.path || !operation.fingerprint)
            throw new Error("Catalog contains an invalid operation");
        if (keys.has(operation.key))
            throw new Error(`Catalog contains duplicate operation key: ${operation.key}`);
        keys.add(operation.key);
    }
}
function escapeCell(value) {
    return (value ?? "").replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ");
}
function markdownIndex(registry) {
    const counts = { pending: 0, verified: 0, blocked: 0, conflict: 0, removed: 0 };
    for (const item of registry.operations) {
        counts[item.verification_status] += 1;
        if (item.lifecycle === "removed")
            counts.removed += 1;
    }
    const lines = [
        `# ${registry.service} API Contract Registry`,
        "",
        `- Environment: \`${registry.environment}\``,
        `- Document SHA-256: \`${registry.document_sha256}\``,
        `- Synced at: \`${registry.synced_at}\``,
        `- Status: verified ${counts.verified}, pending ${counts.pending}, blocked ${counts.blocked}, conflict ${counts.conflict}, removed ${counts.removed}`,
        "",
        "| Operation | Summary | Lifecycle | Verification | Level | Profiles | Reason / note |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ];
    for (const item of registry.operations) {
        const level = item.verification_level ?? (item.verification_status === "verified" ? "L2" : "L0");
        lines.push(`| \`${escapeCell(item.key)}\` | ${escapeCell(item.summary)} | \`${item.lifecycle}\` | \`${item.verification_status}\` | \`${level}\` | ${Object.keys(item.request_profiles ?? {}).length} | ${escapeCell(item.note ?? item.status_reason)} |`);
    }
    return `${lines.join("\n")}\n`;
}
function syncRegistry(catalog, existing, now) {
    const prior = new Map((0, openapi_1.withStableOperationIds)(existing?.operations ?? []).map((item) => [item.key, item]));
    const catalogOperations = (0, openapi_1.withStableOperationIds)(catalog.operations);
    const currentKeys = new Set(catalogOperations.map((item) => item.key));
    const operations = catalogOperations.map((item) => {
        const previous = prior.get(item.key);
        if (previous && previous.fingerprint_version !== item.fingerprint_version) {
            throw new Error(`Fingerprint algorithm differs for ${item.key}; sync refused without changing registry. Confirm and repair the existing contract baseline before using the new catalog.`);
        }
        if (previous?.fingerprint === item.fingerprint && previous.lifecycle !== "removed") {
            return { ...previous, ...item, verification_level: previous.verification_level ?? (previous.verification_status === "verified" ? "L2" : "L0"), lifecycle: previous.lifecycle === "deprecated" ? "deprecated" : "active" };
        }
        return {
            ...item,
            lifecycle: "active",
            verification_status: "pending",
            verification_level: "L0",
            status_reason: previous ? "contract_changed" : "new_operation",
        };
    });
    for (const previous of prior.values()) {
        if (!currentKeys.has(previous.key)) {
            operations.push({
                ...previous,
                lifecycle: "removed",
                verification_status: "pending",
                verification_level: "L0",
                status_reason: "operation_removed",
                verified_at: undefined,
                verified_fingerprint: undefined,
            });
        }
    }
    operations.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
    return {
        version: 1,
        service: catalog.service,
        environment: catalog.environment,
        document_sha256: catalog.document_sha256,
        synced_at: now,
        operations,
    };
}
function runApiContractRegistry(options) {
    try {
        const catalogFile = targetPath(options.projectRoot, options.catalogValue, "--catalog");
        const registryFile = targetPath(options.projectRoot, options.registryValue, "--registry");
        const indexFile = targetPath(options.projectRoot, options.indexValue, "--index");
        const catalog = readJson(catalogFile, "catalog");
        validateCatalog(catalog);
        const now = new Date().toISOString();
        const existing = node_fs_1.default.existsSync(registryFile) ? readJson(registryFile, "registry") : undefined;
        let registry;
        if (options.action === "sync") {
            registry = syncRegistry(catalog, existing, now);
        }
        else if (options.action === "set") {
            if (!existing)
                throw new Error("Registry does not exist; run sync first");
            if (existing.service !== catalog.service || existing.environment !== catalog.environment)
                throw new Error("Registry does not match catalog service/environment");
            if (options.operationKeys.length === 0)
                throw new Error("set requires at least one --operation");
            const statuses = new Set(["pending", "verified", "blocked", "conflict"]);
            const lifecycles = new Set(["active", "deprecated", "removed"]);
            if (options.status && !statuses.has(options.status))
                throw new Error("--status must be pending/verified/blocked/conflict");
            if (options.level && !(0, apiContractVerification_1.isVerificationLevel)(options.level))
                throw new Error("--level must be L0/L1/L2/L3");
            if (options.lifecycle && !lifecycles.has(options.lifecycle))
                throw new Error("--lifecycle must be active/deprecated/removed");
            if (!options.status && !options.lifecycle && !options.level && !options.profileFile)
                throw new Error("set requires --status, --lifecycle, --level, and/or --profile-file");
            if (options.profileFile && !options.requestProfile)
                throw new Error("--profile-file requires --request-profile");
            if (options.requestProfile && !/^[A-Za-z][A-Za-z0-9_-]*$/.test(options.requestProfile))
                throw new Error("--request-profile must be a stable identifier");
            if (options.requestProfile && (options.status || options.lifecycle))
                throw new Error("--status and --lifecycle update the operation; use a separate command from --request-profile");
            if ((options.status === "blocked" || options.status === "conflict") && !options.note?.trim())
                throw new Error("blocked/conflict requires --note");
            if (options.status === "verified" && options.evidence.length === 0)
                throw new Error("verified requires at least one --evidence");
            if (!options.requestProfile && options.level === "L3" && options.evidence.length === 0)
                throw new Error("operation L3 requires at least one --evidence");
            const catalogMap = new Map(catalog.operations.map((item) => [item.key, item]));
            const profileFromFile = options.profileFile ? (0, apiContractVerification_1.validateRequestProfile)(readJson(targetPath(options.projectRoot, options.profileFile, "--profile-file"), "request profile"), "request profile") : undefined;
            const selected = new Set(options.operationKeys.map((item) => item.trim().replace(/\s+/, " ")));
            const known = new Set(existing.operations.map((item) => item.key));
            const unknown = [...selected].filter((key) => !known.has(key));
            if (unknown.length > 0)
                throw new Error(`Unknown registry operation(s): ${unknown.join(", ")}`);
            registry = {
                ...existing,
                document_sha256: catalog.document_sha256,
                synced_at: now,
                operations: existing.operations.map((item) => {
                    if (!selected.has(item.key))
                        return item;
                    const current = catalogMap.get(item.key);
                    if (options.status === "verified") {
                        if (!current || item.lifecycle === "removed")
                            throw new Error(`Cannot verify absent operation: ${item.key}`);
                        if (current.fingerprint !== item.fingerprint)
                            throw new Error(`Registry fingerprint is stale for ${item.key}; run sync first`);
                    }
                    const next = {
                        ...item,
                        ...(options.lifecycle ? { lifecycle: options.lifecycle } : {}),
                        ...(options.status ? { verification_status: options.status } : {}),
                    };
                    if (options.requestProfile) {
                        const profiles = { ...(0, apiContractVerification_1.requestProfiles)(item) };
                        const currentProfile = profiles[options.requestProfile];
                        if (!currentProfile && !profileFromFile)
                            throw new Error(`Unknown request profile ${options.requestProfile} for ${item.key}; provide --profile-file`);
                        const profile = { ...(currentProfile ?? profileFromFile), ...(profileFromFile ?? {}) };
                        if (options.level)
                            profile.verification_level = options.level;
                        if (options.note?.trim())
                            profile.note = options.note.trim();
                        if (options.evidence.length > 0)
                            profile.evidence = options.evidence;
                        if (profile.verification_level === "L3") {
                            if (!profile.evidence?.length)
                                throw new Error(`L3 request profile ${options.requestProfile} requires at least one --evidence or evidence in --profile-file`);
                            profile.verified_at = now;
                        }
                        else
                            delete profile.verified_at;
                        profiles[options.requestProfile] = (0, apiContractVerification_1.validateRequestProfile)(profile, `request profile ${options.requestProfile}`);
                        next.request_profiles = profiles;
                        return next;
                    }
                    if (options.level)
                        next.verification_level = options.level;
                    if (options.status) {
                        delete next.note;
                        delete next.evidence;
                    }
                    if (options.note?.trim())
                        next.note = options.note.trim();
                    if (options.evidence.length > 0)
                        next.evidence = options.evidence;
                    if (!options.status && options.level === "L3")
                        next.verified_at = now;
                    else if (!options.status && options.level && options.level !== "L3")
                        delete next.verified_at;
                    if (options.status === "verified") {
                        next.verification_level = options.level ? options.level : next.verification_level ?? "L2";
                        next.verified_at = now;
                        next.verified_fingerprint = item.fingerprint;
                        next.status_reason = "contract_evidence_aligned";
                    }
                    else if (options.status) {
                        next.verification_level = options.level ? options.level : "L0";
                        delete next.verified_at;
                        delete next.verified_fingerprint;
                        next.status_reason = options.status === "pending" ? "verification_required" : options.status;
                    }
                    return next;
                }),
            };
        }
        else {
            throw new Error("First argument must be sync or set");
        }
        if (!options.dryRun) {
            writeAtomic(registryFile, `${JSON.stringify(registry, null, 2)}\n`);
            writeAtomic(indexFile, markdownIndex(registry));
        }
        const counts = registry.operations.reduce((result, item) => {
            result[item.verification_status] = (result[item.verification_status] ?? 0) + 1;
            return result;
        }, {});
        console.log(JSON.stringify({
            ok: true,
            dry_run: options.dryRun,
            action: options.action,
            service: registry.service,
            environment: registry.environment,
            counts,
            updated_operations: options.action === "set" ? options.operationKeys : undefined,
            request_profile: options.requestProfile,
            files: { registry: options.registryValue, index: options.indexValue },
        }, null, 2));
        return 0;
    }
    catch (error) {
        console.log(JSON.stringify({ ok: false, dry_run: options.dryRun, error: error instanceof Error ? error.message : String(error) }, null, 2));
        return 1;
    }
}
exports.apiContractRegistryTool = {
    name: "api_contract_registry",
    run: async (args, context) => {
        const rest = [...args];
        const action = rest.shift() ?? "";
        const dryRun = rest.includes("--dry-run");
        if (dryRun)
            rest.splice(rest.indexOf("--dry-run"), 1);
        const catalogValue = (0, args_1.consumeOption)(rest, "--catalog") ?? "";
        const registryValue = (0, args_1.consumeOption)(rest, "--registry") ?? "";
        const indexValue = (0, args_1.consumeOption)(rest, "--index") ?? "";
        const operationKeys = (0, args_1.consumeRepeatedOption)(rest, "--operation");
        const status = (0, args_1.consumeOption)(rest, "--status");
        const lifecycle = (0, args_1.consumeOption)(rest, "--lifecycle");
        const note = (0, args_1.consumeOption)(rest, "--note");
        const evidence = (0, args_1.consumeRepeatedOption)(rest, "--evidence");
        const level = (0, args_1.consumeOption)(rest, "--level");
        const requestProfile = (0, args_1.consumeOption)(rest, "--request-profile");
        const profileFile = (0, args_1.consumeOption)(rest, "--profile-file");
        if (rest.length > 0)
            throw new Error(`Unknown api_contract_registry arguments: ${rest.join(" ")}`);
        return runApiContractRegistry({ action, projectRoot: context.projectRoot, catalogValue, registryValue, indexValue, operationKeys, status, lifecycle, note, evidence, level, requestProfile, profileFile, dryRun });
    },
};
