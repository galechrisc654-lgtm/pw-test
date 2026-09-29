"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isJsonObject = isJsonObject;
exports.stableStringify = stableStringify;
exports.sha256 = sha256;
exports.withStableOperationIds = withStableOperationIds;
exports.parseOpenApi = parseOpenApi;
exports.validateOpenApi = validateOpenApi;
exports.resolveJsonPointer = resolveJsonPointer;
exports.referencedComponentClosure = referencedComponentClosure;
exports.operationCatalogForFingerprintVersion = operationCatalogForFingerprintVersion;
exports.operationCatalog = operationCatalog;
exports.unresolvedLocalRefs = unresolvedLocalRefs;
exports.deepClone = deepClone;
const node_crypto_1 = __importDefault(require("node:crypto"));
const HTTP_METHODS = ["get", "put", "post", "delete", "options", "head", "patch", "trace"];
function isJsonObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function normalized(value) {
    if (Array.isArray(value))
        return value.map(normalized);
    if (!isJsonObject(value))
        return value;
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, normalized(value[key])]));
}
function stableStringify(value) {
    return JSON.stringify(normalized(value));
}
function sha256(value) {
    return node_crypto_1.default.createHash("sha256").update(value).digest("hex").toUpperCase();
}
function withStableOperationIds(operations) {
    return operations.map((operation) => ({
        ...operation,
        operation_id: `op_${Buffer.from(operation.key, "utf8").toString("base64url")}`,
    }));
}
function parseOpenApi(text, label = "OpenAPI document") {
    let parsed;
    try {
        parsed = JSON.parse(text);
    }
    catch (error) {
        throw new Error(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
    validateOpenApi(parsed, label);
    return parsed;
}
function validateOpenApi(value, label = "OpenAPI document") {
    if (!isJsonObject(value))
        throw new Error(`${label} must be a JSON object`);
    if (typeof value.openapi !== "string" || !/^3\./.test(value.openapi)) {
        throw new Error(`${label} must declare an OpenAPI 3.x version`);
    }
    if (!isJsonObject(value.info))
        throw new Error(`${label} must contain info`);
    if (!isJsonObject(value.paths))
        throw new Error(`${label} must contain paths`);
}
function decodePointerPart(value) {
    return value.replace(/~1/g, "/").replace(/~0/g, "~");
}
function resolveJsonPointer(root, pointer) {
    if (pointer === "")
        return root;
    if (!pointer.startsWith("/"))
        return undefined;
    let current = root;
    for (const rawPart of pointer.slice(1).split("/")) {
        const part = decodePointerPart(rawPart);
        if (Array.isArray(current)) {
            const index = Number(part);
            if (!Number.isInteger(index) || index < 0 || index >= current.length)
                return undefined;
            current = current[index];
        }
        else if (isJsonObject(current) && Object.prototype.hasOwnProperty.call(current, part)) {
            current = current[part];
        }
        else {
            return undefined;
        }
    }
    return current;
}
function collectLocalRefs(value, refs) {
    if (Array.isArray(value)) {
        value.forEach((item) => collectLocalRefs(item, refs));
        return;
    }
    if (!isJsonObject(value))
        return;
    if (typeof value.$ref === "string" && value.$ref.startsWith("#/"))
        refs.add(value.$ref);
    Object.values(value).forEach((item) => collectLocalRefs(item, refs));
}
function referencedComponentClosure(document, seed) {
    const pending = new Set();
    const resolved = {};
    collectLocalRefs(seed, pending);
    while (pending.size > 0) {
        const ref = [...pending].sort()[0];
        pending.delete(ref);
        if (Object.prototype.hasOwnProperty.call(resolved, ref))
            continue;
        const value = resolveJsonPointer(document, ref.slice(1));
        if (value === undefined) {
            resolved[ref] = { unresolved: true };
            continue;
        }
        resolved[ref] = value;
        collectLocalRefs(value, pending);
    }
    return resolved;
}
function operationForFingerprint(operation, version) {
    const result = deepClone(operation);
    if (version === 3) {
        return Object.fromEntries(["requestBody", "responses", "callbacks"]
            .filter((name) => Object.prototype.hasOwnProperty.call(result, name))
            .map((name) => [name, result[name]]));
    }
    delete result.operationId;
    delete result.security;
    delete result.servers;
    delete result["x-api-contract-verification"];
    delete result["x-api-contract-source"];
    return result;
}
function parameterIdentity(document, value, fallback) {
    let parameter = value;
    if (isJsonObject(value) && typeof value.$ref === "string" && value.$ref.startsWith("#/")) {
        parameter = resolveJsonPointer(document, value.$ref.slice(1));
    }
    if (!isJsonObject(parameter) || typeof parameter.name !== "string" || typeof parameter.in !== "string")
        return fallback;
    const name = parameter.in === "header" ? parameter.name.toLowerCase() : parameter.name;
    return `${parameter.in}\u0000${name}`;
}
function parameterForFingerprint(document, value) {
    let parameter = value;
    if (isJsonObject(value) && typeof value.$ref === "string" && value.$ref.startsWith("#/")) {
        parameter = resolveJsonPointer(document, value.$ref.slice(1)) ?? value;
    }
    if (!isJsonObject(parameter))
        return parameter;
    const result = deepClone(parameter);
    if (result.in === "header" && typeof result.name === "string")
        result.name = result.name.toLowerCase();
    return result;
}
function effectiveParameters(document, pathItem, operation) {
    const result = new Map();
    const add = (parameters, scope) => {
        if (!Array.isArray(parameters))
            return;
        parameters.forEach((parameter, index) => result.set(parameterIdentity(document, parameter, `${scope}\u0000${index}`), parameterForFingerprint(document, parameter)));
    };
    add(pathItem.parameters, "path");
    add(operation.parameters, "operation");
    return [...result.values()];
}
function securitySchemeForFingerprint(value) {
    if (!isJsonObject(value) || typeof value.type !== "string")
        return value;
    if (value.type === "apiKey")
        return { type: value.type, name: value.name, in: value.in };
    if (value.type === "http")
        return { type: value.type, scheme: value.scheme };
    if (value.type === "oauth2") {
        return { type: value.type, flows: isJsonObject(value.flows) ? Object.keys(value.flows).sort() : [] };
    }
    return { type: value.type };
}
// Only annotations are ignored. Map entries and literal payloads may themselves
// be named "description", "example", etc.; those names remain contractual.
function protocolValue(document, value, key = "", stack = [], version = 3) {
    if (["default", "const", "enum"].includes(key)) {
        if (key === "enum" && Array.isArray(value))
            return value.map(normalized).sort((a, b) => stableStringify(a).localeCompare(stableStringify(b)));
        return normalized(value);
    }
    if (Array.isArray(value)) {
        const entries = value.map(item => protocolValue(document, item, "", stack, version));
        return ["required", "parameters", "security", "allOf", "anyOf", "oneOf", "type"].includes(key)
            ? entries.sort((a, b) => stableStringify(a).localeCompare(stableStringify(b))) : entries;
    }
    if (!isJsonObject(value))
        return value;
    if (["properties", "patternProperties", "$defs", "content", "responses", "headers", "encoding", "dependentSchemas"].includes(key)) {
        return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, protocolValue(document, item, "", stack, version)]));
    }
    const result = {};
    for (const [name, item] of Object.entries(value)) {
        if (["summary", "description", "title", "example", "examples", "externalDocs", "tags", "operationId", "x-api-contract-source", "x-api-contract-verification"].includes(name))
            continue;
        if (version === 3 && (name === "deprecated" || name.startsWith("x-")))
            continue;
        if (name === "$ref" && typeof item === "string" && item.startsWith("#/")) {
            const ancestor = stack.indexOf(item);
            const target = resolveJsonPointer(document, item.slice(1));
            result.$ref = ancestor >= 0 ? { recursiveDepth: stack.length - ancestor }
                : target === undefined ? { unresolved: item } : protocolValue(document, target, "", [...stack, item], version);
        }
        else if (name === "security" && Array.isArray(item)) {
            result.security = item.map(requirement => {
                if (!isJsonObject(requirement))
                    return requirement;
                if (version === 2) {
                    return Object.fromEntries(Object.entries(requirement).map(([scheme, scopes]) => [scheme, {
                            definition: protocolValue(document, resolveJsonPointer(document, `/components/securitySchemes/${scheme.replace(/~/g, "~0").replace(/\//g, "~1")}`), "", stack, version),
                            scopes: Array.isArray(scopes) ? [...scopes].sort() : scopes,
                        }]));
                }
                return Object.entries(requirement).map(([scheme, scopes]) => ({
                    definition: securitySchemeForFingerprint(resolveJsonPointer(document, `/components/securitySchemes/${scheme.replace(/~/g, "~0").replace(/\//g, "~1")}`)),
                    scopes: Array.isArray(scopes) ? [...scopes].sort() : scopes,
                })).sort((a, b) => stableStringify(a).localeCompare(stableStringify(b)));
            }).sort((a, b) => stableStringify(a).localeCompare(stableStringify(b)));
        }
        else
            result[name] = protocolValue(document, item, name, stack, version);
    }
    return result;
}
function protocolFingerprint(document, seed, version) {
    return sha256(stableStringify(protocolValue(document, seed, "", [], version)));
}
function variantEntries(document, route, method, pathItem, operation, version) {
    const rawVariants = operation["x-api-contract-variants"];
    if (rawVariants === undefined)
        return undefined;
    if (!Array.isArray(rawVariants) || rawVariants.length === 0)
        throw new Error(`x-api-contract-variants must be a non-empty array: ${method.toUpperCase()} ${route}`);
    const ids = new Set();
    return rawVariants.map((rawVariant) => {
        if (!isJsonObject(rawVariant) || typeof rawVariant.id !== "string" || !rawVariant.id.trim() || rawVariant.id.includes("#")) {
            throw new Error(`Contract variant requires a non-empty id without #: ${method.toUpperCase()} ${route}`);
        }
        const id = rawVariant.id.trim();
        if (ids.has(id))
            throw new Error(`Duplicate contract variant id ${id}: ${method.toUpperCase()} ${route}`);
        ids.add(id);
        if (!isJsonObject(rawVariant.selector) || typeof rawVariant.selector.location !== "string" || typeof rawVariant.selector.path !== "string" || typeof rawVariant.selector.equals !== "string") {
            throw new Error(`Contract variant ${id} requires selector.location, selector.path, and selector.equals`);
        }
        const variantOperation = operationForFingerprint(operation, version);
        delete variantOperation["x-api-contract-variants"];
        if (typeof rawVariant.schema_ref === "string") {
            if (!rawVariant.schema_ref.startsWith("#/"))
                throw new Error(`Contract variant ${id} schema_ref must be a local OpenAPI ref`);
            const requestBody = isJsonObject(variantOperation.requestBody) ? variantOperation.requestBody : {};
            const content = isJsonObject(requestBody.content) ? requestBody.content : {};
            const mediaTypes = Object.keys(content).length > 0 ? Object.keys(content) : ["application/json"];
            requestBody.content = Object.fromEntries(mediaTypes.map((mediaType) => {
                const current = isJsonObject(content[mediaType]) ? content[mediaType] : {};
                return [mediaType, { ...current, schema: { $ref: rawVariant.schema_ref } }];
            }));
            variantOperation.requestBody = requestBody;
        }
        const seed = {
            method: method.toUpperCase(),
            path: route,
            selector: rawVariant.selector,
            operation: variantOperation,
            security: operation.security ?? document.security ?? [],
        };
        if (version === 2) {
            seed.path_parameters = pathItem.parameters ?? [];
            seed.servers = operation.servers ?? pathItem.servers ?? document.servers ?? [];
        }
        else
            seed.parameters = effectiveParameters(document, pathItem, operation);
        const source = isJsonObject(operation["x-api-contract-source"]) ? operation["x-api-contract-source"] : undefined;
        return {
            key: `${method.toUpperCase()} ${route}#${id}`,
            method: method.toUpperCase(),
            path: route,
            variant_id: id,
            selector: deepClone(rawVariant.selector),
            ...(typeof operation.operationId === "string" ? { operation_id: operation.operationId } : {}),
            ...(typeof operation.summary === "string" ? { summary: `${operation.summary} [${id}]` } : { summary: id }),
            tags: Array.isArray(operation.tags) ? operation.tags.filter((tag) => typeof tag === "string") : [],
            ...(source ? { source: deepClone(source) } : {}),
            fingerprint: protocolFingerprint(document, seed, version),
            fingerprint_version: version,
        };
    });
}
function operationCatalogForFingerprintVersion(document, version) {
    const paths = document.paths;
    const entries = [];
    for (const route of Object.keys(paths).sort()) {
        const pathItem = paths[route];
        if (!isJsonObject(pathItem))
            continue;
        for (const method of HTTP_METHODS) {
            const operation = pathItem[method];
            if (!isJsonObject(operation))
                continue;
            const variants = variantEntries(document, route, method, pathItem, operation, version);
            if (variants) {
                entries.push(...variants);
                continue;
            }
            const fingerprintOperation = operationForFingerprint(operation, version);
            const seed = {
                method: method.toUpperCase(),
                path: route,
                operation: fingerprintOperation,
                security: operation.security ?? document.security ?? [],
            };
            if (version === 2) {
                seed.path_parameters = pathItem.parameters ?? [];
                seed.servers = operation.servers ?? pathItem.servers ?? document.servers ?? [];
            }
            else
                seed.parameters = effectiveParameters(document, pathItem, operation);
            const source = isJsonObject(operation["x-api-contract-source"]) ? operation["x-api-contract-source"] : undefined;
            entries.push({
                key: `${method.toUpperCase()} ${route}`,
                method: method.toUpperCase(),
                path: route,
                ...(typeof operation.operationId === "string" ? { operation_id: operation.operationId } : {}),
                ...(typeof operation.summary === "string" ? { summary: operation.summary } : {}),
                tags: Array.isArray(operation.tags) ? operation.tags.filter((tag) => typeof tag === "string") : [],
                ...(source ? { source: deepClone(source) } : {}),
                fingerprint: protocolFingerprint(document, seed, version),
                fingerprint_version: version,
            });
        }
    }
    return withStableOperationIds(entries);
}
function operationCatalog(document) {
    return operationCatalogForFingerprintVersion(document, 3);
}
function unresolvedLocalRefs(document) {
    const refs = new Set();
    collectLocalRefs(document, refs);
    return [...refs].filter((ref) => resolveJsonPointer(document, ref.slice(1)) === undefined).sort();
}
function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
}
