"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.openapiFetcherTool = void 0;
exports.runOpenApiFetcher = runOpenApiFetcher;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const openapi_1 = require("../core/openapi");
const args_1 = require("./args");
function expandVariables(value, projectRoot) {
    const localFile = node_path_1.default.join(projectRoot, "references", "integrations", "secrets.local.json");
    const localConfig = node_fs_1.default.existsSync(localFile) ? JSON.parse(node_fs_1.default.readFileSync(localFile, "utf8")) : {};
    const locals = localConfig.locals && typeof localConfig.locals === "object" && !Array.isArray(localConfig.locals)
        ? localConfig.locals
        : {};
    const secrets = localConfig.secrets && typeof localConfig.secrets === "object" && !Array.isArray(localConfig.secrets)
        ? localConfig.secrets
        : {};
    const pattern = /\$\{(env|local|secret):([^}]+)\}|\$\{project_root\}/g;
    const unresolvedPattern = /\$\{(?:env|local|secret):[^}]+\}|\$\{project_root\}/;
    const resolveString = (input, depth = 0) => {
        if (depth > 10)
            throw new Error("Configuration variable expansion exceeded maximum depth");
        let replaced = false;
        const output = input.replace(pattern, (match, kind, name) => {
            replaced = true;
            if (match === "${project_root}")
                return projectRoot.replace(/\\/g, "/");
            let resolved;
            if (kind === "env")
                resolved = process.env[name ?? ""];
            if (kind === "local")
                resolved = locals[name ?? ""];
            if (kind === "secret")
                resolved = secrets[name ?? ""];
            if (resolved === undefined)
                throw new Error(`Configuration variable is not set: ${kind}:${name}`);
            if (typeof resolved !== "string" && typeof resolved !== "number" && typeof resolved !== "boolean") {
                throw new Error(`Configuration variable must be a scalar value: ${kind}:${name}`);
            }
            return String(resolved);
        });
        return replaced && unresolvedPattern.test(output) ? resolveString(output, depth + 1) : output;
    };
    const visit = (item) => {
        if (Array.isArray(item))
            return item.map(visit);
        if (item && typeof item === "object") {
            return Object.fromEntries(Object.entries(item).map(([key, child]) => [key, visit(child)]));
        }
        return typeof item === "string" ? resolveString(item) : item;
    };
    return visit(value);
}
function normalizeProductConfig(value, requestedService) {
    const services = Array.isArray(value.services) ? value.services : [];
    const enabled = services.filter((service) => service.enabled !== false);
    const service = requestedService
        ? services.find((item) => item.id === requestedService)
        : enabled.length === 1 ? enabled[0] : undefined;
    if (!service) {
        if (requestedService)
            throw new Error(`API service not found in product config: ${requestedService}`);
        throw new Error("Product API config contains multiple or no enabled services; specify --service");
    }
    if (service.enabled === false)
        throw new Error(`API service is disabled: ${service.id}`);
    if (!service.id)
        throw new Error("Configured API service is missing id");
    const outputRoot = value.defaults?.output_root ?? "resources/api_contracts";
    const serviceRoot = node_path_1.default.posix.join(outputRoot.replace(/\\/g, "/"), service.id);
    return {
        version: 1,
        service: service.id,
        environment: service.environment ?? value.defaults?.environment,
        source: {
            url: service.document_source?.url,
            headers: service.document_source?.headers,
            timeout_ms: service.timeout_ms ?? value.defaults?.timeout_ms,
        },
        output: {
            raw: `${serviceRoot}/openapi.raw.json`,
            metadata: `${serviceRoot}/source.json`,
            changes: `${serviceRoot}/changes.json`,
        },
    };
}
function projectPath(projectRoot, value, label) {
    const resolved = node_path_1.default.resolve(projectRoot, value);
    const relative = node_path_1.default.relative(projectRoot, resolved);
    if (relative.startsWith("..") || node_path_1.default.isAbsolute(relative))
        throw new Error(`${label} must stay inside project root: ${value}`);
    return resolved;
}
function readConfig(projectRoot, file, requestedService) {
    if (!file)
        return {};
    const target = projectPath(projectRoot, file, "config");
    const parsed = JSON.parse(node_fs_1.default.readFileSync(target, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        throw new Error("OpenAPI fetch config must be a JSON object");
    const selected = Array.isArray(parsed.services)
        ? normalizeProductConfig(parsed, requestedService)
        : parsed;
    return expandVariables(selected, projectRoot);
}
function writeJsonAtomic(file, value) {
    node_fs_1.default.mkdirSync(node_path_1.default.dirname(file), { recursive: true });
    const temporary = `${file}.tmp-${process.pid}`;
    node_fs_1.default.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    node_fs_1.default.renameSync(temporary, file);
}
function writeTextAtomic(file, value) {
    node_fs_1.default.mkdirSync(node_path_1.default.dirname(file), { recursive: true });
    const temporary = `${file}.tmp-${process.pid}`;
    node_fs_1.default.writeFileSync(temporary, value, "utf8");
    node_fs_1.default.renameSync(temporary, file);
}
function displayUrl(value) {
    const safe = new URL(value.toString());
    safe.username = "";
    safe.password = "";
    for (const key of [...safe.searchParams.keys()])
        safe.searchParams.set(key, "***");
    return safe.toString();
}
async function runOpenApiFetcher(options) {
    try {
        const config = readConfig(options.projectRoot, options.configFile, options.service);
        const service = options.service ?? config.service ?? "";
        const environment = options.environment ?? config.environment ?? "";
        const url = options.url ?? config.source?.url ?? "";
        const rawValue = options.raw ?? config.output?.raw ?? "";
        const metadataValue = options.metadata ?? config.output?.metadata ?? "";
        const catalogValue = options.catalog ?? config.output?.catalog;
        const changesValue = options.changes ?? config.output?.changes ?? "";
        const timeoutMs = options.timeoutMs ?? config.source?.timeout_ms ?? 30_000;
        if (!service.trim())
            throw new Error("service is required in config or --service");
        if (!environment.trim())
            throw new Error("environment is required in config or --environment");
        if (!url.trim())
            throw new Error("source.url is required in config or --url");
        if (!rawValue || !metadataValue || !changesValue) {
            throw new Error("output.raw, output.metadata, and output.changes are required");
        }
        if (!Number.isFinite(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 300_000)
            throw new Error("timeout_ms must be between 1000 and 300000");
        const parsedUrl = new URL(url);
        if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:")
            throw new Error("OpenAPI source URL must use HTTP or HTTPS");
        const rawFile = projectPath(options.projectRoot, rawValue, "output.raw");
        const metadataFile = projectPath(options.projectRoot, metadataValue, "output.metadata");
        const catalogFile = catalogValue ? projectPath(options.projectRoot, catalogValue, "output.catalog") : undefined;
        const changesFile = projectPath(options.projectRoot, changesValue, "output.changes");
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        let response;
        try {
            response = await fetch(parsedUrl, { headers: config.source?.headers, signal: controller.signal });
        }
        finally {
            clearTimeout(timeout);
        }
        if (!response.ok)
            throw new Error(`OpenAPI source returned HTTP ${response.status}`);
        const fetchedText = await response.text();
        const document = (0, openapi_1.parseOpenApi)(fetchedText, "Fetched OpenAPI document");
        const checkedAt = new Date().toISOString();
        const fetchedRawSha256 = (0, openapi_1.sha256)(fetchedText);
        const canonicalSha256 = (0, openapi_1.sha256)((0, openapi_1.stableStringify)(document));
        const operations = (0, openapi_1.operationCatalog)(document);
        let previousDocumentSha256;
        let previousOperations = [];
        if (node_fs_1.default.existsSync(rawFile)) {
            try {
                const previousDocument = (0, openapi_1.parseOpenApi)(node_fs_1.default.readFileSync(rawFile, "utf8"), "Previous source OpenAPI document");
                previousDocumentSha256 = (0, openapi_1.sha256)((0, openapi_1.stableStringify)(previousDocument));
                previousOperations = (0, openapi_1.operationCatalog)(previousDocument);
            }
            catch {
                previousDocumentSha256 = undefined;
                previousOperations = [];
            }
        }
        const previousMap = new Map(previousOperations.map((item) => [item.key, item.fingerprint]));
        const currentMap = new Map(operations.map((item) => [item.key, item.fingerprint]));
        const added = operations.filter((item) => !previousMap.has(item.key)).map((item) => item.key);
        const changed = operations.filter((item) => previousMap.has(item.key) && previousMap.get(item.key) !== item.fingerprint).map((item) => item.key);
        const removed = [...previousMap.keys()].filter((key) => !currentMap.has(key)).sort();
        const unchanged = operations.filter((item) => previousMap.get(item.key) === item.fingerprint).map((item) => item.key);
        const documentChanged = previousDocumentSha256 !== canonicalSha256;
        let snapshotAt = checkedAt;
        let storedRawSha256 = fetchedRawSha256;
        if (!documentChanged && node_fs_1.default.existsSync(rawFile)) {
            const existingText = node_fs_1.default.readFileSync(rawFile, "utf8");
            storedRawSha256 = (0, openapi_1.sha256)(existingText);
            try {
                const existingMetadata = JSON.parse(node_fs_1.default.readFileSync(metadataFile, "utf8"));
                snapshotAt = existingMetadata.snapshot_at ?? checkedAt;
            }
            catch {
                snapshotAt = checkedAt;
            }
        }
        const metadata = {
            version: 1,
            service,
            environment,
            source_url: displayUrl(parsedUrl),
            snapshot_at: snapshotAt,
            last_checked_at: checkedAt,
            document_changed: documentChanged,
            stored_raw_sha256: storedRawSha256,
            fetched_raw_sha256: fetchedRawSha256,
            canonical_sha256: canonicalSha256,
            operation_count: operations.length,
        };
        const catalog = { version: 1, service, environment, fetched_at: checkedAt, document_sha256: canonicalSha256, operations };
        const changes = {
            version: 1,
            service,
            environment,
            compared_at: checkedAt,
            previous_document_sha256: previousDocumentSha256 ?? null,
            current_document_sha256: canonicalSha256,
            document_changed: documentChanged,
            added,
            changed,
            removed,
            unchanged,
        };
        if (!options.dryRun) {
            if (documentChanged || !node_fs_1.default.existsSync(rawFile))
                writeTextAtomic(rawFile, fetchedText);
            writeJsonAtomic(metadataFile, metadata);
            if (catalogFile)
                writeJsonAtomic(catalogFile, catalog);
            writeJsonAtomic(changesFile, changes);
        }
        console.log(JSON.stringify({
            ok: true,
            dry_run: options.dryRun,
            document_changed: documentChanged,
            operation_count: operations.length,
            change_counts: { added: added.length, changed: changed.length, removed: removed.length, unchanged: unchanged.length },
            files: { raw: rawValue, metadata: metadataValue, ...(catalogValue ? { source_catalog: catalogValue } : {}), changes: changesValue },
            metadata,
        }, null, 2));
        return 0;
    }
    catch (error) {
        console.log(JSON.stringify({ ok: false, dry_run: options.dryRun, error: error instanceof Error ? error.message : String(error) }, null, 2));
        return 1;
    }
}
exports.openapiFetcherTool = {
    name: "openapi_fetcher",
    run: async (args, context) => {
        const rest = [...args];
        const dryRun = rest.includes("--dry-run");
        if (dryRun)
            rest.splice(rest.indexOf("--dry-run"), 1);
        const configFile = (0, args_1.consumeOption)(rest, "--config");
        const url = (0, args_1.consumeOption)(rest, "--url");
        const service = (0, args_1.consumeOption)(rest, "--service");
        const environment = (0, args_1.consumeOption)(rest, "--environment");
        const raw = (0, args_1.consumeOption)(rest, "--raw");
        const metadata = (0, args_1.consumeOption)(rest, "--metadata");
        const catalog = (0, args_1.consumeOption)(rest, "--catalog");
        const changes = (0, args_1.consumeOption)(rest, "--changes");
        const timeoutValue = (0, args_1.consumeOption)(rest, "--timeout-ms");
        if (rest.length > 0)
            throw new Error(`Unknown openapi_fetcher arguments: ${rest.join(" ")}`);
        return runOpenApiFetcher({
            projectRoot: context.projectRoot,
            configFile,
            url,
            service,
            environment,
            raw,
            metadata,
            catalog,
            changes,
            ...(timeoutValue ? { timeoutMs: Number(timeoutValue) } : {}),
            dryRun,
        });
    },
};
