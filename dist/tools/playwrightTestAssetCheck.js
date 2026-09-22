"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.playwrightTestAssetCheckTool = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const typescript_1 = __importDefault(require("typescript"));
const args_1 = require("./args");
const apiContractVerification_1 = require("./apiContractVerification");
const slash = (value) => value.split(node_path_1.default.sep).join("/");
const inside = (root, target) => { const relative = node_path_1.default.relative(root, target); return relative === "" || (!relative.startsWith("..") && !node_path_1.default.isAbsolute(relative)); };
function collect(root) {
    if (!node_fs_1.default.existsSync(root) || !node_fs_1.default.statSync(root).isDirectory())
        return [];
    const result = [];
    const pending = [root];
    while (pending.length) {
        const current = pending.pop();
        for (const entry of node_fs_1.default.readdirSync(current, { withFileTypes: true })) {
            const target = node_path_1.default.join(current, entry.name);
            if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== ".aiprod-local")
                pending.push(target);
            else if (entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts"))
                result.push(node_path_1.default.resolve(target));
        }
    }
    return result.sort((a, b) => a.localeCompare(b));
}
function kindOf(projectRoot, assetRoot, file) {
    const relative = slash(node_path_1.default.relative(projectRoot, file));
    if (relative.includes("/testing-pw/tests/"))
        return "test";
    if (!inside(assetRoot, file))
        return "support";
    const parts = slash(node_path_1.default.relative(assetRoot, file)).split("/");
    if (parts.includes("actions"))
        return "action";
    if (parts.includes("flows") && node_path_1.default.basename(file) === "flow.ts")
        return "flow";
    if (parts.includes("components"))
        return "component";
    if (parts.includes("pages"))
        return "page";
    return "support";
}
function literal(node) {
    if (typescript_1.default.isStringLiteralLike(node))
        return node.text;
    if (node.kind === typescript_1.default.SyntaxKind.TrueKeyword)
        return true;
    if (node.kind === typescript_1.default.SyntaxKind.FalseKeyword)
        return false;
    if (typescript_1.default.isArrayLiteralExpression(node))
        return node.elements.map((item) => literal(item));
    if (typescript_1.default.isObjectLiteralExpression(node)) {
        const value = {};
        for (const item of node.properties) {
            if (!typescript_1.default.isPropertyAssignment(item))
                continue;
            const name = typescript_1.default.isIdentifier(item.name) || typescript_1.default.isStringLiteralLike(item.name) ? item.name.text : undefined;
            if (name)
                value[name] = literal(item.initializer);
        }
        return value;
    }
    return undefined;
}
function resolveImport(source, specifier) {
    if (!specifier.startsWith("."))
        return undefined;
    const base = node_path_1.default.resolve(node_path_1.default.dirname(source), specifier);
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, node_path_1.default.join(base, "index.ts"), node_path_1.default.join(base, "index.tsx")]) {
        if (node_fs_1.default.existsSync(candidate) && node_fs_1.default.statSync(candidate).isFile())
            return node_path_1.default.resolve(candidate);
    }
    return node_path_1.default.resolve(`${base}.ts`);
}
function parse(projectRoot, assetRoot, file) {
    const source = typescript_1.default.createSourceFile(file, node_fs_1.default.readFileSync(file, "utf8"), typescript_1.default.ScriptTarget.Latest, true);
    let metadata = {};
    const imports = [];
    source.forEachChild((node) => {
        if (typescript_1.default.isImportDeclaration(node) && typescript_1.default.isStringLiteral(node.moduleSpecifier)) {
            const target = resolveImport(file, node.moduleSpecifier.text);
            if (target)
                imports.push(target);
        }
        if (!typescript_1.default.isVariableStatement(node))
            return;
        for (const declaration of node.declarationList.declarations) {
            if (!typescript_1.default.isIdentifier(declaration.name) || declaration.name.text !== "aiprod" || !declaration.initializer)
                continue;
            const expression = typescript_1.default.isSatisfiesExpression(declaration.initializer) ? declaration.initializer.expression : declaration.initializer;
            if (typescript_1.default.isObjectLiteralExpression(expression))
                metadata = literal(expression);
        }
    });
    return {
        file,
        relative: slash(node_path_1.default.relative(projectRoot, file)),
        kind: kindOf(projectRoot, assetRoot, file),
        id: typeof metadata.id === "string" ? metadata.id : undefined,
        title: typeof metadata.title === "string" ? metadata.title : undefined,
        mode: typeof metadata.mode === "string" ? metadata.mode : undefined,
        caseId: typeof metadata.caseId === "string" ? metadata.caseId : undefined,
        contracts: Array.isArray(metadata.contracts) ? metadata.contracts.filter((item) => Boolean(item) && typeof item === "object") : [],
        imports: [...new Set(imports)],
    };
}
function contractIssues(projectRoot, asset) {
    const issues = [];
    if (asset.kind === "action" && asset.contracts.length === 0)
        issues.push({ code: "missing-contract", file: asset.relative, message: "Action must declare at least one direct Contract reference in exported aiprod metadata." });
    for (const ref of asset.contracts) {
        const label = `${ref.service ?? "?"}:${ref.operationId ?? "?"}`;
        if (!ref.service || !ref.operationId || !ref.fingerprint || !/^[A-Fa-f0-9]{8,64}$/.test(ref.fingerprint)) {
            issues.push({ code: "invalid-contract-reference", file: asset.relative, message: `Invalid Contract reference ${label}.` });
            continue;
        }
        const registryFile = node_path_1.default.join(projectRoot, "resources", "api_contracts", ref.service, "registry.json");
        let registry;
        try {
            registry = JSON.parse(node_fs_1.default.readFileSync(registryFile, "utf8"));
        }
        catch {
            issues.push({ code: "missing-contract-registry", file: asset.relative, message: `Contract registry not found or invalid for ${ref.service}.` });
            continue;
        }
        const operation = (registry.operations ?? []).find((item) => item.operation_id === ref.operationId);
        if (!operation) {
            issues.push({ code: "missing-contract-operation", file: asset.relative, message: `Operation ${label} is not maintained.` });
            continue;
        }
        if (operation.lifecycle !== "active")
            issues.push({ code: "inactive-contract-operation", file: asset.relative, message: `Operation ${label} must be active.` });
        if (operation.fingerprint !== ref.fingerprint)
            issues.push({ code: "contract-fingerprint-mismatch", file: asset.relative, message: `Fingerprint for ${label} does not match.` });
        if (!(0, apiContractVerification_1.isCallableOperation)(operation))
            issues.push({ code: "uncallable-contract-operation", file: asset.relative, message: `Operation ${label} must be verified at L2 or above.` });
        if (ref.requestProfile) {
            const profile = (0, apiContractVerification_1.requestProfiles)(operation)[ref.requestProfile];
            if (!profile)
                issues.push({ code: "missing-request-profile", file: asset.relative, message: `Request profile ${label}:${ref.requestProfile} is not maintained.` });
            else if (!(0, apiContractVerification_1.levelAtLeast)(profile.verification_level, "L2"))
                issues.push({ code: "uncallable-request-profile", file: asset.relative, message: `Request profile ${label}:${ref.requestProfile} must be L2 or above.` });
        }
    }
    return issues;
}
function indexDocument(assets) {
    const rows = assets.filter((asset) => asset.kind !== "support").map((asset) => {
        const contracts = asset.contracts.map((item) => `${item.service}:${item.operationId}:${item.fingerprint}`).join("<br>");
        return `| ${asset.kind} | ${asset.id ?? asset.caseId ?? ""} | ${asset.title ?? ""} | \`${asset.relative}\` | ${asset.mode ?? ""} | ${contracts} |`;
    });
    return ["# Playwright 公共测试资产索引", "", "> 由 `playwright_test_asset_check --write-index` 生成，请勿手工维护。", "", "| 类型 | ID / 用例 | 标题 | 路径 | 模式 | 直接 Contract |", "| --- | --- | --- | --- | --- | --- |", ...rows, ""].join("\n");
}
function run(args, projectRoot) {
    const targetValue = (0, args_1.consumeOption)(args, "--target");
    const writeIndexAt = args.indexOf("--write-index");
    const writeIndex = writeIndexAt >= 0;
    if (writeIndex)
        args.splice(writeIndexAt, 1);
    if (args.length)
        throw new Error(`Unknown playwright_test_asset_check arguments: ${args.join(" ")}`);
    const assetRoot = node_path_1.default.join(projectRoot, "resources", "api_test_scenarios-pw");
    const roots = targetValue ? [node_path_1.default.resolve(projectRoot, targetValue)] : [assetRoot, node_path_1.default.join(projectRoot, "changes"), node_path_1.default.join(projectRoot, "work", "testing")];
    if (targetValue && !inside(projectRoot, roots[0]))
        throw new Error("--target must stay inside the project root");
    const files = [...new Set(roots.flatMap((root) => node_fs_1.default.existsSync(root) && node_fs_1.default.statSync(root).isFile() ? [root] : collect(root)))]
        .filter((file) => inside(assetRoot, file) || slash(node_path_1.default.relative(projectRoot, file)).includes("/testing-pw/tests/"));
    const assets = files.map((file) => parse(projectRoot, assetRoot, file));
    const issues = [];
    const ids = new Map();
    for (const asset of assets) {
        if (["action", "flow", "page", "component"].includes(asset.kind) && !asset.id)
            issues.push({ code: "missing-metadata", file: asset.relative, message: "Export a literal `aiprod` object with a stable id." });
        if (asset.kind === "test" && (!asset.caseId || !["api", "ui", "hybrid"].includes(asset.mode ?? "")))
            issues.push({ code: "invalid-test-metadata", file: asset.relative, message: "Test must export literal aiprod metadata with caseId and mode api, ui or hybrid." });
        if (asset.kind === "test" && asset.mode && !asset.relative.endsWith(`.${asset.mode}.spec.ts`))
            issues.push({ code: "test-mode-filename-mismatch", file: asset.relative, message: `mode ${asset.mode} requires filename suffix .${asset.mode}.spec.ts.` });
        if (asset.id) {
            const previous = ids.get(asset.id);
            if (previous)
                issues.push({ code: "duplicate-id", file: asset.relative, message: `Asset id ${asset.id} is already used by ${previous.relative}.` });
            else
                ids.set(asset.id, asset);
        }
        for (const imported of asset.imports)
            if (!node_fs_1.default.existsSync(imported))
                issues.push({ code: "missing-import", file: asset.relative, message: `Relative import cannot be resolved: ${slash(node_path_1.default.relative(projectRoot, imported))}.` });
        issues.push(...contractIssues(projectRoot, asset));
        if (["action", "flow", "page", "component"].includes(asset.kind) && asset.relative.includes("/testing-pw/"))
            issues.push({ code: "invalid-layer", file: asset.relative, message: "Public assets must stay under resources/api_test_scenarios-pw/." });
    }
    const indexFile = node_path_1.default.join(assetRoot, "index.md");
    if (writeIndex) {
        node_fs_1.default.mkdirSync(assetRoot, { recursive: true });
        node_fs_1.default.writeFileSync(indexFile, indexDocument(assets.filter((asset) => inside(assetRoot, asset.file))), "utf8");
    }
    console.log(JSON.stringify({ ok: issues.length === 0, checked_files: assets.length, issue_count: issues.length, issues, index: writeIndex ? slash(node_path_1.default.relative(projectRoot, indexFile)) : null }, null, 2));
    return issues.length === 0 ? 0 : 1;
}
exports.playwrightTestAssetCheckTool = {
    name: "playwright_test_asset_check",
    run: async (args, context) => {
        try {
            return run([...args], context.projectRoot);
        }
        catch (error) {
            console.log(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
            return 1;
        }
    },
};
