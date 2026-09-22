"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.karateTestAssetCheckTool = void 0;
exports.runKarateTestAssetCheck = runKarateTestAssetCheck;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const args_1 = require("./args");
const apiContractVerification_1 = require("./apiContractVerification");
function slash(value) {
    return value.split(node_path_1.default.sep).join("/");
}
function inside(root, target) {
    const relative = node_path_1.default.relative(root, target);
    return relative === "" || (!relative.startsWith("..") && !node_path_1.default.isAbsolute(relative));
}
function projectPath(projectRoot, value, label) {
    const target = node_path_1.default.resolve(projectRoot, value);
    if (!inside(projectRoot, target))
        throw new Error(`${label} must stay inside the project root: ${value}`);
    return target;
}
function collectFeatureFiles(root) {
    if (!node_fs_1.default.existsSync(root) || !node_fs_1.default.statSync(root).isDirectory())
        return [];
    const files = [];
    const pending = [root];
    while (pending.length > 0) {
        const current = pending.pop();
        for (const entry of node_fs_1.default.readdirSync(current, { withFileTypes: true })) {
            const target = node_path_1.default.join(current, entry.name);
            if (entry.isDirectory())
                pending.push(target);
            else if (entry.isFile() && entry.name.endsWith(".feature"))
                files.push(node_path_1.default.resolve(target));
        }
    }
    return files.sort((a, b) => a.localeCompare(b));
}
function testFeatureFiles(projectRoot) {
    const files = [
        ...collectFeatureFiles(node_path_1.default.join(projectRoot, "changes")),
        ...collectFeatureFiles(node_path_1.default.join(projectRoot, "work", "testing")),
    ];
    return files.filter((file) => slash(node_path_1.default.relative(projectRoot, file)).includes("/testing-ka/features/"));
}
function assetType(projectRoot, assetRoot, file) {
    const relative = slash(node_path_1.default.relative(projectRoot, file));
    if (relative.includes("/testing-ka/features/"))
        return "test";
    if (!inside(assetRoot, file))
        return "other";
    const segments = slash(node_path_1.default.relative(assetRoot, file)).split("/");
    if (segments.includes("actions"))
        return "action";
    if (segments.includes("fixtures"))
        return "fixture";
    return "other";
}
function featureReferences(projectRoot, source, content) {
    const references = [];
    const pattern = /\bread\s*\(\s*(['"])([^'"]+\.feature(?:@[A-Za-z0-9_-]+)?)\1\s*\)/g;
    for (const match of content.matchAll(pattern)) {
        const raw = match[2].replace(/@[A-Za-z0-9_-]+$/, "");
        const target = raw.startsWith("classpath:")
            ? node_path_1.default.resolve(projectRoot, raw.slice("classpath:".length).replace(/^[/\\]+/, ""))
            : node_path_1.default.resolve(node_path_1.default.dirname(source), raw);
        references.push(node_path_1.default.resolve(target));
    }
    return [...new Set(references)];
}
function parseAsset(projectRoot, assetRoot, file) {
    const content = node_fs_1.default.readFileSync(file, "utf8");
    const type = assetType(projectRoot, assetRoot, file);
    const metadata = type === "action"
        ? /^\s*@action=([^\s]+)\s*$/m.exec(content)
        : type === "fixture" ? /^\s*@fixture=([^\s]+)\s*$/m.exec(content) : null;
    return {
        file,
        relative: slash(node_path_1.default.relative(projectRoot, file)),
        type,
        id: metadata?.[1],
        title: /^\s*Feature:\s*(.+?)\s*$/m.exec(content)?.[1],
        content,
        references: featureReferences(projectRoot, file, content),
    };
}
function contractIssues(projectRoot, asset) {
    const issues = [];
    const tagTokens = asset.content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.startsWith("@"))
        .flatMap((line) => line.split(/\s+/));
    const contractValues = tagTokens
        .filter((token) => token === "@contract" || token.startsWith("@contract="))
        .map((token) => token.startsWith("@contract=") ? token.slice("@contract=".length) : "");
    const tags = contractValues.flatMap((value) => {
        const match = /^([^:\s]+):([^:\s]+):([A-Fa-f0-9]{8,64})$/.exec(value);
        if (match)
            return [match];
        issues.push({ code: "invalid-contract-tag", file: asset.relative, message: `Invalid @contract tag: ${value || "(empty)"}. Expected service:operation_id:fingerprint.` });
        return [];
    });
    if (asset.type === "action" && tags.length === 0) {
        issues.push({ code: "missing-contract", file: asset.relative, message: "Action must declare at least one @contract service:operation_id:fingerprint reference." });
    }
    const registries = new Map();
    for (const tag of tags) {
        const service = tag[1];
        const operationId = tag[2];
        const fingerprint = tag[3];
        if (!registries.has(service)) {
            const file = node_path_1.default.join(projectRoot, "resources", "api_contracts", service, "registry.json");
            try {
                registries.set(service, JSON.parse(node_fs_1.default.readFileSync(file, "utf8")));
            }
            catch {
                registries.set(service, null);
            }
        }
        const registry = registries.get(service);
        if (!registry) {
            issues.push({ code: "missing-contract-registry", file: asset.relative, message: `Contract registry not found or invalid for service ${service}.` });
            continue;
        }
        const operation = (registry.operations ?? []).find((item) => item.operation_id === operationId);
        if (!operation) {
            issues.push({ code: "missing-contract-operation", file: asset.relative, message: `Operation ${service}:${operationId} is not present in the maintained registry.` });
            continue;
        }
        if (operation.lifecycle !== "active") {
            issues.push({ code: "inactive-contract-operation", file: asset.relative, message: `Operation ${service}:${operationId} must be active before use.` });
        }
        if (operation.fingerprint !== fingerprint) {
            issues.push({ code: "contract-fingerprint-mismatch", file: asset.relative, message: `Fingerprint for ${service}:${operationId} does not match the maintained registry.` });
        }
        if (!(0, apiContractVerification_1.isCallableOperation)(operation)) {
            issues.push({ code: "uncallable-contract-operation", file: asset.relative, message: `Operation ${service}:${operationId} must be verified at L2 or above for its current fingerprint.` });
        }
    }
    const profileValues = tagTokens
        .filter((token) => token === "@request-profile" || token.startsWith("@request-profile="))
        .map((token) => token.startsWith("@request-profile=") ? token.slice("@request-profile=".length) : "");
    const profileTags = profileValues.flatMap((value) => {
        const match = /^([^:\s]+):([^:\s]+):([A-Za-z][A-Za-z0-9_-]*)$/.exec(value);
        if (match)
            return [match];
        issues.push({ code: "invalid-request-profile-tag", file: asset.relative, message: `Invalid @request-profile tag: ${value || "(empty)"}. Expected service:operation_id:profile_id.` });
        return [];
    });
    for (const tag of profileTags) {
        const service = tag[1];
        const operationId = tag[2];
        const profileId = tag[3];
        if (!registries.has(service)) {
            const file = node_path_1.default.join(projectRoot, "resources", "api_contracts", service, "registry.json");
            try {
                registries.set(service, JSON.parse(node_fs_1.default.readFileSync(file, "utf8")));
            }
            catch {
                registries.set(service, null);
            }
        }
        const operation = (registries.get(service)?.operations ?? []).find((item) => item.operation_id === operationId);
        const profile = operation ? (0, apiContractVerification_1.requestProfiles)(operation)[profileId] : undefined;
        if (!operation) {
            issues.push({ code: "missing-request-profile-operation", file: asset.relative, message: `Request profile refers to unknown operation ${service}:${operationId}.` });
        }
        else if (!profile) {
            issues.push({ code: "missing-request-profile", file: asset.relative, message: `Request profile ${profileId} is not registered for ${service}:${operationId}.` });
        }
        else if (!(0, apiContractVerification_1.levelAtLeast)(profile.verification_level, "L2")) {
            issues.push({ code: "uncallable-request-profile", file: asset.relative, message: `Request profile ${service}:${operationId}:${profileId} must be L2 or above.` });
        }
    }
    return issues;
}
function foreignSyntaxIssues(asset) {
    const patterns = [
        ["foreign-postman-syntax", /\bpm\.[A-Za-z_$]/, "Feature contains Postman pm.* syntax; use Karate variables and APIs."],
        ["foreign-template-syntax", /\{\{[^}\r\n]+\}\}/, "Feature contains {{...}} variable syntax; use Karate variables."],
        ["foreign-data-syntax", /\$\{data:/, "Feature contains ${data:...} syntax; use Karate variables or @data sessions."],
    ];
    return patterns
        .filter(([, pattern]) => pattern.test(asset.content))
        .map(([code, , message]) => ({ code, file: asset.relative, message }));
}
function generatedIndex(assets) {
    const publicAssets = assets.filter((asset) => asset.type === "action" || asset.type === "fixture")
        .sort((a, b) => a.type.localeCompare(b.type) || (a.id ?? "").localeCompare(b.id ?? ""));
    const lines = [
        "# Karate 公共测试资产索引",
        "",
        "本文件由 `karate_test_asset_check --write-index` 根据公共 Feature 生成，不得手工维护。",
        "",
        "| Type | ID | Feature | Path |",
        "| --- | --- | --- | --- |",
        ...publicAssets.map((asset) => `| ${asset.type} | \`${asset.id ?? "missing"}\` | ${asset.title ?? ""} | \`${asset.relative}\` |`),
    ];
    return `${lines.join("\n")}\n`;
}
function findCycles(publicAssets, byFile) {
    const publicFiles = new Set(publicAssets.map((asset) => asset.file));
    const state = new Map();
    const stack = [];
    const cycles = [];
    const visit = (file) => {
        state.set(file, 1);
        stack.push(file);
        for (const target of byFile.get(file)?.references ?? []) {
            if (!publicFiles.has(target))
                continue;
            if (!state.has(target))
                visit(target);
            else if (state.get(target) === 1) {
                const start = stack.indexOf(target);
                cycles.push([...stack.slice(start), target]);
            }
        }
        stack.pop();
        state.set(file, 2);
    };
    for (const asset of publicAssets)
        if (!state.has(asset.file))
            visit(asset.file);
    return cycles;
}
function runKarateTestAssetCheck(options) {
    try {
        const assetRoot = projectPath(options.projectRoot, options.rootValue, "--root");
        if (!node_fs_1.default.existsSync(assetRoot) || !node_fs_1.default.statSync(assetRoot).isDirectory())
            throw new Error(`Test asset root not found: ${options.rootValue}`);
        const featureFiles = [...new Set([...collectFeatureFiles(assetRoot), ...testFeatureFiles(options.projectRoot)])];
        const assets = featureFiles.map((file) => parseAsset(options.projectRoot, assetRoot, file));
        const byFile = new Map(assets.map((asset) => [asset.file, asset]));
        const publicAssets = assets.filter((asset) => asset.type === "action" || asset.type === "fixture");
        const issues = [];
        const ids = new Map();
        for (const asset of assets) {
            issues.push(...foreignSyntaxIssues(asset));
            issues.push(...contractIssues(options.projectRoot, asset));
            for (const target of asset.references) {
                if (!node_fs_1.default.existsSync(target)) {
                    issues.push({ code: "missing-feature-reference", file: asset.relative, message: `Referenced Feature does not exist: ${slash(node_path_1.default.relative(options.projectRoot, target))}.` });
                }
            }
        }
        for (const asset of publicAssets) {
            if (!/(?:^|\s)@ignore(?:\s|$)/m.test(asset.content))
                issues.push({ code: "missing-ignore", file: asset.relative, message: "Public Action and Fixture Features must use @ignore." });
            if (!asset.id || !/^[a-z0-9][a-z0-9-]*$/.test(asset.id)) {
                issues.push({ code: "invalid-asset-id", file: asset.relative, message: `Expected a stable @${asset.type}=lowercase-hyphen-id tag.` });
            }
            else {
                const duplicate = ids.get(asset.id);
                if (duplicate)
                    issues.push({ code: "duplicate-asset-id", file: asset.relative, message: `Asset ID ${asset.id} is already used by ${duplicate.relative}.` });
                else
                    ids.set(asset.id, asset);
            }
            for (const target of asset.references) {
                const targetAsset = byFile.get(target);
                if (!node_fs_1.default.existsSync(target))
                    continue;
                if (!inside(assetRoot, target))
                    issues.push({ code: "public-to-private-reference", file: asset.relative, message: `Public asset references a Feature outside the public test asset root: ${slash(node_path_1.default.relative(options.projectRoot, target))}.` });
                if (asset.type === "action" && targetAsset && (targetAsset.type === "fixture" || targetAsset.type === "test"))
                    issues.push({ code: "action-layer-violation", file: asset.relative, message: `Action cannot call ${targetAsset.type} Feature ${targetAsset.relative}.` });
                if (asset.type === "fixture" && targetAsset?.type === "test")
                    issues.push({ code: "fixture-layer-violation", file: asset.relative, message: `Fixture cannot call Test Feature ${targetAsset.relative}.` });
            }
        }
        for (const cycle of findCycles(publicAssets, byFile)) {
            issues.push({ code: "feature-cycle", file: slash(node_path_1.default.relative(options.projectRoot, cycle[0])), message: cycle.map((file) => slash(node_path_1.default.relative(options.projectRoot, file))).join(" -> ") });
        }
        const reverse = new Map();
        for (const asset of assets)
            for (const target of asset.references) {
                const callers = reverse.get(target) ?? new Set();
                callers.add(asset.file);
                reverse.set(target, callers);
            }
        const targetFiles = options.targetValues.length > 0
            ? options.targetValues.map((value) => projectPath(options.projectRoot, value, "--target"))
            : publicAssets.map((asset) => asset.file);
        for (const target of targetFiles) {
            if (!byFile.has(target))
                issues.push({ code: "unknown-target", file: slash(node_path_1.default.relative(options.projectRoot, target)), message: "Target is not a scanned Karate Feature." });
        }
        const callers = targetFiles.map((target) => {
            const direct = [...(reverse.get(target) ?? [])];
            const all = new Set(direct);
            const pending = [...direct];
            while (pending.length > 0) {
                const current = pending.shift();
                for (const caller of reverse.get(current) ?? [])
                    if (!all.has(caller)) {
                        all.add(caller);
                        pending.push(caller);
                    }
            }
            return {
                target: slash(node_path_1.default.relative(options.projectRoot, target)),
                direct: direct.map((file) => slash(node_path_1.default.relative(options.projectRoot, file))).sort(),
                transitive: [...all].map((file) => slash(node_path_1.default.relative(options.projectRoot, file))).sort(),
            };
        });
        let index = null;
        if (options.writeIndex && issues.length === 0) {
            const indexFile = node_path_1.default.join(assetRoot, "index.md");
            node_fs_1.default.writeFileSync(indexFile, generatedIndex(assets), "utf8");
            index = slash(node_path_1.default.relative(options.projectRoot, indexFile));
        }
        console.log(JSON.stringify({
            ok: issues.length === 0,
            root: slash(node_path_1.default.relative(options.projectRoot, assetRoot)),
            counts: {
                actions: publicAssets.filter((asset) => asset.type === "action").length,
                fixtures: publicAssets.filter((asset) => asset.type === "fixture").length,
                test_features: assets.filter((asset) => asset.type === "test").length,
            },
            issues,
            callers,
            index,
        }, null, 2));
        return issues.length === 0 ? 0 : 1;
    }
    catch (error) {
        console.log(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
        return 1;
    }
}
exports.karateTestAssetCheckTool = {
    name: "karate_test_asset_check",
    run: async (args, context) => {
        const rest = [...args];
        const rootValue = (0, args_1.consumeOption)(rest, "--root") ?? "resources/api_test_scenarios-ka";
        const targetValues = (0, args_1.consumeRepeatedOption)(rest, "--target");
        const writeIndex = rest.includes("--write-index");
        if (writeIndex)
            rest.splice(rest.indexOf("--write-index"), 1);
        if (rest.length > 0)
            throw new Error(`Unknown karate_test_asset_check arguments: ${rest.join(" ")}`);
        return runKarateTestAssetCheck({ projectRoot: context.projectRoot, rootValue, targetValues, writeIndex });
    },
};
