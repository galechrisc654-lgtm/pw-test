"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.openapiDocumentBuilderTool = void 0;
exports.runOpenApiDocumentBuilder = runOpenApiDocumentBuilder;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const openapi_1 = require("../core/openapi");
const args_1 = require("./args");
const HTTP_METHODS = new Set(["get", "put", "post", "delete", "options", "head", "patch", "trace"]);
function projectPath(projectRoot, value, label) {
    if (!value)
        throw new Error(`${label} is required`);
    const resolved = node_path_1.default.resolve(projectRoot, value);
    const relative = node_path_1.default.relative(projectRoot, resolved);
    if (relative.startsWith("..") || node_path_1.default.isAbsolute(relative))
        throw new Error(`${label} must stay inside project root: ${value}`);
    return resolved;
}
function pointerParts(pointer) {
    if (!pointer.startsWith("/") || pointer === "/")
        throw new Error(`Invalid JSON Pointer: ${pointer}`);
    return pointer.slice(1).split("/").map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"));
}
function applyPatch(root, patch) {
    const parts = pointerParts(patch.path);
    const finalPart = parts.pop();
    let parent = root;
    for (const part of parts) {
        if (Array.isArray(parent)) {
            const index = Number(part);
            if (!Number.isInteger(index) || index < 0 || index >= parent.length)
                throw new Error(`Patch parent does not exist: ${patch.path}`);
            parent = parent[index];
        }
        else if ((0, openapi_1.isJsonObject)(parent) && Object.prototype.hasOwnProperty.call(parent, part)) {
            parent = parent[part];
        }
        else {
            throw new Error(`Patch parent does not exist: ${patch.path}`);
        }
    }
    if (Array.isArray(parent)) {
        const index = finalPart === "-" ? parent.length : Number(finalPart);
        if (!Number.isInteger(index) || index < 0)
            throw new Error(`Invalid array patch path: ${patch.path}`);
        if (patch.op === "add")
            parent.splice(index, 0, (0, openapi_1.deepClone)(patch.value));
        else if (patch.op === "replace") {
            if (index >= parent.length)
                throw new Error(`Replace target does not exist: ${patch.path}`);
            parent[index] = (0, openapi_1.deepClone)(patch.value);
        }
        else {
            if (index >= parent.length)
                throw new Error(`Remove target does not exist: ${patch.path}`);
            parent.splice(index, 1);
        }
        return;
    }
    if (!(0, openapi_1.isJsonObject)(parent))
        throw new Error(`Patch parent is not an object: ${patch.path}`);
    const exists = Object.prototype.hasOwnProperty.call(parent, finalPart);
    if (patch.op === "add")
        parent[finalPart] = (0, openapi_1.deepClone)(patch.value);
    else if (patch.op === "replace") {
        if (!exists)
            throw new Error(`Replace target does not exist: ${patch.path}`);
        parent[finalPart] = (0, openapi_1.deepClone)(patch.value);
    }
    else {
        if (!exists)
            throw new Error(`Remove target does not exist: ${patch.path}`);
        delete parent[finalPart];
    }
}
function mergeSupplement(resolved, supplement) {
    if (supplement.version !== 1 || !(0, openapi_1.isJsonObject)(supplement.paths))
        throw new Error("Supplement must contain version 1 and a paths object");
    const resolvedPaths = resolved.paths;
    let operationCount = 0;
    for (const [route, rawPathItem] of Object.entries(supplement.paths)) {
        if (!route.startsWith("/") || !(0, openapi_1.isJsonObject)(rawPathItem))
            throw new Error(`Supplement contains an invalid path: ${route}`);
        const targetPathItem = (0, openapi_1.isJsonObject)(resolvedPaths[route]) ? resolvedPaths[route] : {};
        for (const [key, rawValue] of Object.entries(rawPathItem)) {
            if (!HTTP_METHODS.has(key)) {
                if (targetPathItem[key] !== undefined && (0, openapi_1.stableStringify)(targetPathItem[key]) !== (0, openapi_1.stableStringify)(rawValue)) {
                    throw new Error(`Supplement path field conflicts with source: ${route} ${key}`);
                }
                if (targetPathItem[key] === undefined)
                    targetPathItem[key] = (0, openapi_1.deepClone)(rawValue);
                continue;
            }
            if (!(0, openapi_1.isJsonObject)(rawValue))
                throw new Error(`Supplement operation must be an object: ${key.toUpperCase()} ${route}`);
            if (targetPathItem[key] !== undefined)
                throw new Error(`Supplement operation already exists in source OpenAPI: ${key.toUpperCase()} ${route}`);
            const operation = (0, openapi_1.deepClone)(rawValue);
            const baseKey = `${key.toUpperCase()} ${route}`;
            const variants = Array.isArray(operation["x-api-contract-variants"]) ? operation["x-api-contract-variants"] : [];
            const evidenceKeys = [baseKey, ...variants.flatMap((variant) => (0, openapi_1.isJsonObject)(variant) && typeof variant.id === "string" ? [`${baseKey}#${variant.id}`] : [])];
            const evidence = evidenceKeys.flatMap((evidenceKey) => supplement.evidence?.[evidenceKey] ?? []);
            operation["x-api-contract-source"] = {
                kind: "code-supplement",
                evidence: [...new Set(evidence)],
            };
            targetPathItem[key] = operation;
            operationCount += 1;
        }
        resolvedPaths[route] = targetPathItem;
    }
    if (supplement.components !== undefined) {
        if (!(0, openapi_1.isJsonObject)(supplement.components))
            throw new Error("Supplement components must be an object");
        if (!(0, openapi_1.isJsonObject)(resolved.components))
            resolved.components = {};
        const targetComponents = resolved.components;
        for (const [section, rawSection] of Object.entries(supplement.components)) {
            if (!(0, openapi_1.isJsonObject)(rawSection))
                throw new Error(`Supplement component section must be an object: ${section}`);
            if (!(0, openapi_1.isJsonObject)(targetComponents[section]))
                targetComponents[section] = {};
            const targetSection = targetComponents[section];
            for (const [name, value] of Object.entries(rawSection)) {
                if (targetSection[name] !== undefined && (0, openapi_1.stableStringify)(targetSection[name]) !== (0, openapi_1.stableStringify)(value)) {
                    throw new Error(`Supplement component conflicts with source OpenAPI: ${section}/${name}`);
                }
                if (targetSection[name] === undefined)
                    targetSection[name] = (0, openapi_1.deepClone)(value);
            }
        }
    }
    return operationCount;
}
function runOpenApiDocumentBuilder(options) {
    try {
        const sourceFile = projectPath(options.projectRoot, options.sourceValue, "--source");
        const outputFile = projectPath(options.projectRoot, options.outputValue, "--output");
        const source = (0, openapi_1.parseOpenApi)(node_fs_1.default.readFileSync(sourceFile, "utf8"), "Source OpenAPI document");
        const sourceSha256 = (0, openapi_1.sha256)((0, openapi_1.stableStringify)(source));
        const resolved = (0, openapi_1.deepClone)(source);
        let sourceMetadata = {};
        if (options.sourceMetadataValue) {
            const sourceMetadataFile = projectPath(options.projectRoot, options.sourceMetadataValue, "--source-metadata");
            sourceMetadata = JSON.parse(node_fs_1.default.readFileSync(sourceMetadataFile, "utf8"));
        }
        let supplementSha256 = null;
        let supplementOperationCount = 0;
        if (options.supplementValue) {
            const supplementFile = projectPath(options.projectRoot, options.supplementValue, "--supplement");
            const supplementText = node_fs_1.default.readFileSync(supplementFile, "utf8");
            const supplement = JSON.parse(supplementText);
            supplementSha256 = (0, openapi_1.sha256)((0, openapi_1.stableStringify)(supplement));
            supplementOperationCount = mergeSupplement(resolved, supplement);
        }
        let patches = [];
        if (options.overlayValue) {
            const overlayFile = projectPath(options.projectRoot, options.overlayValue, "--overlay");
            const overlay = JSON.parse(node_fs_1.default.readFileSync(overlayFile, "utf8"));
            if (!Array.isArray(overlay.patches))
                throw new Error("Overlay must contain a patches array");
            patches = overlay.patches;
            for (const patch of patches) {
                if (!patch || !["add", "replace", "remove"].includes(patch.op) || typeof patch.path !== "string")
                    throw new Error("Overlay contains an invalid patch");
                if ((patch.op === "add" || patch.op === "replace") && !("value" in patch))
                    throw new Error(`${patch.op} patch requires value: ${patch.path}`);
                applyPatch(resolved, patch);
            }
        }
        (0, openapi_1.validateOpenApi)(resolved, "Resolved OpenAPI document");
        const unresolved = (0, openapi_1.unresolvedLocalRefs)(resolved);
        if (unresolved.length > 0)
            throw new Error(`Resolved document contains unresolved local refs: ${unresolved.slice(0, 10).join(", ")}`);
        const catalogEntries = (0, openapi_1.operationCatalog)(resolved);
        const contractSha256 = (0, openapi_1.sha256)((0, openapi_1.stableStringify)(resolved));
        const catalog = {
            version: 1,
            service: sourceMetadata.service ?? "",
            environment: sourceMetadata.environment ?? "",
            generated_at: new Date().toISOString(),
            document_sha256: contractSha256,
            source_document_sha256: sourceSha256,
            operations: catalogEntries,
        };
        if (options.catalogValue && (!catalog.service || !catalog.environment)) {
            throw new Error("--catalog requires --source-metadata containing service and environment");
        }
        let registry;
        if (options.registryValue) {
            const registryFile = projectPath(options.projectRoot, options.registryValue, "--registry");
            registry = JSON.parse(node_fs_1.default.readFileSync(registryFile, "utf8"));
            if (registry?.document_sha256 !== contractSha256)
                throw new Error("Registry does not match resolved contract; rebuild the catalog and sync first");
        }
        if (registry) {
            const registryMap = new Map((registry.operations ?? []).map((item) => [item.key, item]));
            const verificationByOperation = new Map();
            for (const operation of catalogEntries) {
                const item = registryMap.get(operation.key);
                const status = item?.fingerprint === operation.fingerprint ? item.verification_status ?? "pending" : "pending";
                const baseKey = `${operation.method} ${operation.path}`;
                if (operation.variant_id) {
                    const current = verificationByOperation.get(baseKey);
                    const variants = typeof current === "object" ? current : {};
                    variants[operation.variant_id] = status;
                    verificationByOperation.set(baseKey, variants);
                }
                else {
                    verificationByOperation.set(baseKey, status);
                }
            }
            for (const operation of catalogEntries) {
                const pathItem = resolved.paths[operation.path];
                if ((0, openapi_1.isJsonObject)(pathItem) && (0, openapi_1.isJsonObject)(pathItem[operation.method.toLowerCase()])) {
                    const verification = verificationByOperation.get(`${operation.method} ${operation.path}`) ?? "pending";
                    pathItem[operation.method.toLowerCase()]["x-api-contract-verification"] = typeof verification === "object" ? { variants: verification } : verification;
                }
            }
        }
        const outputSha256 = (0, openapi_1.sha256)((0, openapi_1.stableStringify)(resolved));
        const metadata = {
            version: 1,
            built_at: new Date().toISOString(),
            source: options.sourceValue,
            source_sha256: sourceSha256,
            supplement: options.supplementValue ?? null,
            supplement_sha256: supplementSha256,
            supplement_operation_count: supplementOperationCount,
            overlay: options.overlayValue ?? null,
            patch_count: patches.length,
            operations: "all",
            contract_sha256: contractSha256,
            output_sha256: outputSha256,
        };
        if (!options.dryRun) {
            node_fs_1.default.mkdirSync(node_path_1.default.dirname(outputFile), { recursive: true });
            node_fs_1.default.writeFileSync(outputFile, `${JSON.stringify(resolved, null, 2)}\n`, "utf8");
            if (options.catalogValue) {
                const catalogFile = projectPath(options.projectRoot, options.catalogValue, "--catalog");
                node_fs_1.default.mkdirSync(node_path_1.default.dirname(catalogFile), { recursive: true });
                node_fs_1.default.writeFileSync(catalogFile, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
            }
            if (options.metadataValue) {
                const metadataFile = projectPath(options.projectRoot, options.metadataValue, "--metadata");
                node_fs_1.default.mkdirSync(node_path_1.default.dirname(metadataFile), { recursive: true });
                node_fs_1.default.writeFileSync(metadataFile, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
            }
        }
        console.log(JSON.stringify({ ok: true, dry_run: options.dryRun, output: options.outputValue, catalog: options.catalogValue ?? null, metadata, operation_count: catalogEntries.length }, null, 2));
        return 0;
    }
    catch (error) {
        console.log(JSON.stringify({ ok: false, dry_run: options.dryRun, error: error instanceof Error ? error.message : String(error) }, null, 2));
        return 1;
    }
}
exports.openapiDocumentBuilderTool = {
    name: "openapi_document_builder",
    run: async (args, context) => {
        const rest = [...args];
        const dryRun = rest.includes("--dry-run");
        if (dryRun)
            rest.splice(rest.indexOf("--dry-run"), 1);
        const sourceValue = (0, args_1.consumeOption)(rest, "--source") ?? "";
        const sourceMetadataValue = (0, args_1.consumeOption)(rest, "--source-metadata");
        const supplementValue = (0, args_1.consumeOption)(rest, "--supplement");
        const overlayValue = (0, args_1.consumeOption)(rest, "--overlay");
        const registryValue = (0, args_1.consumeOption)(rest, "--registry");
        const outputValue = (0, args_1.consumeOption)(rest, "--output") ?? "";
        const metadataValue = (0, args_1.consumeOption)(rest, "--metadata");
        const catalogValue = (0, args_1.consumeOption)(rest, "--catalog");
        if (rest.length > 0)
            throw new Error(`Unknown openapi_document_builder arguments: ${rest.join(" ")}`);
        return runOpenApiDocumentBuilder({ projectRoot: context.projectRoot, sourceValue, sourceMetadataValue, supplementValue, overlayValue, registryValue, outputValue, metadataValue, catalogValue, dryRun });
    },
};
