"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.contractSnapshot = contractSnapshot;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const apiContractVerification_1 = require("../tools/apiContractVerification");
function isRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function requiredText(value, name) {
    if (typeof value !== "string" || !value.trim())
        throw new Error(`${name} is required`);
    return value.trim();
}
function stableId(value, option) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(value))
        throw new Error(`${option} must be a single stable ID`);
    return value;
}
function readJsonObject(file, label) {
    if (!node_fs_1.default.existsSync(file) || !node_fs_1.default.statSync(file).isFile())
        throw new Error(`${label} not found: ${file}`);
    const value = JSON.parse(node_fs_1.default.readFileSync(file, "utf8"));
    if (!isRecord(value))
        throw new Error(`${label} must be a JSON object`);
    return value;
}
function contractSnapshot(projectRoot, targetEnvironment, declaredReferences = []) {
    const rawBindings = targetEnvironment.contract_bindings;
    const deploymentValue = isRecord(targetEnvironment.deployment) ? targetEnvironment.deployment : {};
    const deploymentVersion = typeof deploymentValue.version === "string" && deploymentValue.version.trim() ? deploymentValue.version.trim() : undefined;
    const rawRevisions = isRecord(deploymentValue.code_revisions) ? deploymentValue.code_revisions : {};
    const codeRevisions = Object.fromEntries(Object.entries(rawRevisions).map(([id, value]) => {
        if (typeof value !== "string" || !/^[0-9a-f]{40}$/i.test(value))
            throw new Error(`deployment.code_revisions.${id} must be a full 40-character Git SHA`);
        return [id, value.toLowerCase()];
    }));
    let bindings = [];
    if (rawBindings !== undefined) {
        if (!Array.isArray(rawBindings) || rawBindings.length === 0)
            throw new Error("environment contract_bindings must be a non-empty array when configured");
        bindings = rawBindings.map((rawBinding, index) => {
            if (!isRecord(rawBinding))
                throw new Error(`contract_bindings[${index}] must be an object`);
            const service = stableId(requiredText(rawBinding.service, `contract_bindings[${index}].service`), `contract_bindings[${index}].service`);
            const expectedEnvironment = requiredText(rawBinding.environment, `contract_bindings[${index}].environment`);
            const serviceRoot = node_path_1.default.join(projectRoot, "resources", "api_contracts", service);
            const registry = readJsonObject(node_path_1.default.join(serviceRoot, "registry.json"), `Contract registry for ${service}`);
            const metadata = readJsonObject(node_path_1.default.join(serviceRoot, "resolved.metadata.json"), `Resolved Contract metadata for ${service}`);
            const actualService = requiredText(registry.service, `registry.service for ${service}`);
            const actualEnvironment = requiredText(registry.environment, `registry.environment for ${service}`);
            const documentSha256 = requiredText(registry.document_sha256, `registry.document_sha256 for ${service}`);
            const contractSha256 = requiredText(metadata.contract_sha256, `resolved.metadata.contract_sha256 for ${service}`);
            if (actualService !== service)
                throw new Error(`Contract binding service mismatch: expected ${service}, registry contains ${actualService}`);
            if (actualEnvironment !== expectedEnvironment)
                throw new Error(`Contract binding environment mismatch for ${service}: expected ${expectedEnvironment}, registry contains ${actualEnvironment}`);
            if (documentSha256 !== contractSha256)
                throw new Error(`Contract binding is stale for ${service}: registry and resolved Contract hashes differ`);
            return {
                service,
                environment: actualEnvironment,
                document_sha256: documentSha256,
                contract_sha256: contractSha256,
                ...(typeof registry.synced_at === "string" ? { registry_synced_at: registry.synced_at } : {}),
            };
        });
    }
    const codeAlignment = {};
    if (Object.keys(codeRevisions).length > 0) {
        const config = readJsonObject(node_path_1.default.join(projectRoot, "resources", "api_contracts", "api-contracts.json"), "API Contract configuration");
        const roots = Array.isArray(config.code_roots) ? config.code_roots : [];
        const configured = new Map(roots.flatMap((root) => isRecord(root) && typeof root.id === "string" && typeof root.commit === "string" ? [[root.id, root.commit.toLowerCase()]] : []));
        for (const [id, revision] of Object.entries(codeRevisions)) {
            const contractRevision = configured.get(id);
            if (contractRevision && contractRevision !== revision)
                throw new Error(`Deployment revision does not match API Contract code baseline for ${id}: ${revision} != ${contractRevision}`);
            codeAlignment[id] = contractRevision ? "matched" : "unknown";
        }
    }
    const hasRevisions = Object.keys(codeRevisions).length > 0;
    const hasAssociation = rawBindings !== undefined || Boolean(deploymentVersion) || hasRevisions;
    const fullyMatched = rawBindings !== undefined && hasRevisions && !Object.values(codeAlignment).includes("unknown");
    const alignment = !hasAssociation ? "unconfigured" : fullyMatched ? "matched" : "partially_matched";
    const registries = new Map();
    const operations = declaredReferences.map((reference) => {
        let registry = registries.get(reference.service);
        if (!registry) {
            registry = readJsonObject(node_path_1.default.join(projectRoot, "resources", "api_contracts", reference.service, "registry.json"), `Contract registry for ${reference.service}`);
            registries.set(reference.service, registry);
        }
        const entries = Array.isArray(registry.operations) ? registry.operations : [];
        const operation = entries.find((item) => isRecord(item) && item.operation_id === reference.operation_id);
        if (!operation)
            throw new Error(`Contract operation not found: ${reference.service}:${reference.operation_id}`);
        if (operation.lifecycle !== "active")
            throw new Error(`Contract operation is not active: ${reference.service}:${reference.operation_id}`);
        const resolution = (0, apiContractVerification_1.resolveDeclaredFingerprint)(operation, reference.fingerprint);
        if (!resolution)
            throw new Error(`Contract fingerprint does not match current or compatible fingerprint: ${reference.service}:${reference.operation_id}`);
        if (!(0, apiContractVerification_1.isCallableOperation)(operation))
            throw new Error(`Contract operation is not verified at L2 or above: ${reference.service}:${reference.operation_id}`);
        if (reference.request_profile) {
            const profile = (0, apiContractVerification_1.requestProfiles)(operation)[reference.request_profile];
            if (!profile || !(0, apiContractVerification_1.levelAtLeast)(profile.verification_level, "L2"))
                throw new Error(`Contract request profile is not verified at L2 or above: ${reference.service}:${reference.operation_id}:${reference.request_profile}`);
        }
        return { ...reference, ...resolution };
    });
    return { alignment, bindings, operations, deployment: { ...(deploymentVersion ? { version: deploymentVersion } : {}), code_revisions: codeRevisions, code_alignment: codeAlignment } };
}
