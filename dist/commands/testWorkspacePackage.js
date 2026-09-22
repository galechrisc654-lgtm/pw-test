"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testWorkspacePackageCommand = testWorkspacePackageCommand;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_child_process_1 = require("node:child_process");
const fs_1 = require("../core/fs");
const paths_1 = require("../core/paths");
const testWorkspace_1 = require("../core/testWorkspace");
function copyFile(source, target) {
    (0, fs_1.writeManagedFile)(target, (0, fs_1.readText)(source), "new");
}
const packageName = "@aiprod/pw-test-workspace";
function verifyPackageOutput(output) {
    const manifestPath = node_path_1.default.join(output, "package.json");
    if (!node_fs_1.default.existsSync(manifestPath))
        throw new Error(`Package output is not initialized: ${output}`);
    const manifest = JSON.parse((0, fs_1.readText)(manifestPath));
    if (manifest.name !== packageName)
        throw new Error(`Package output is not managed by ${packageName}: ${output}`);
}
function populatePackage(output, action) {
    if (action === "build") {
        if (node_fs_1.default.existsSync(output) && node_fs_1.default.readdirSync(output).length > 0)
            throw new Error(`Package output must be empty: ${output}`);
        (0, fs_1.ensureDir)(output);
    }
    else {
        verifyPackageOutput(output);
        node_fs_1.default.rmSync(node_path_1.default.join(output, "dist"), { recursive: true, force: true });
        node_fs_1.default.rmSync(node_path_1.default.join(output, "framework"), { recursive: true, force: true });
        node_fs_1.default.rmSync(node_path_1.default.join(output, "node_modules", "typescript"), { recursive: true, force: true });
    }
    (0, fs_1.copyDirectory)(node_path_1.default.join((0, paths_1.aiprodRoot)(), "dist"), node_path_1.default.join(output, "dist"), "new");
    node_fs_1.default.rmSync(node_path_1.default.join(output, "dist", "cli.js"), { force: true });
    const typescriptPackage = node_path_1.default.join((0, paths_1.aiprodRoot)(), "node_modules", "typescript");
    if (!node_fs_1.default.existsSync(node_path_1.default.join(typescriptPackage, "package.json")))
        throw new Error("typescript runtime dependency is not installed; run npm install before building the test workspace package");
    node_fs_1.default.cpSync(typescriptPackage, node_path_1.default.join(output, "node_modules", "typescript"), { recursive: true });
    for (const relative of testWorkspace_1.testWorkspacePayloadDirectories)
        (0, fs_1.copyDirectory)(node_path_1.default.join((0, paths_1.frameworkAiprodDir)(), relative), node_path_1.default.join(output, "framework", "_aiprod", relative), "new");
    for (const relative of testWorkspace_1.testWorkspaceScaffoldFiles)
        copyFile(node_path_1.default.join((0, paths_1.scaffoldDir)(), relative), node_path_1.default.join(output, "framework", "scaffold", relative));
    copyFile(node_path_1.default.join((0, paths_1.testScaffoldDir)(), "AGENTS.md"), node_path_1.default.join(output, "framework", "test-scaffold", "AGENTS.md"));
    copyFile(node_path_1.default.join((0, paths_1.testScaffoldDir)(), "pw-test-workspace-gui.vbs"), node_path_1.default.join(output, "pw-test-workspace-gui.vbs"));
    copyFile((0, paths_1.frameworkVersionPath)(), node_path_1.default.join(output, "framework", "VERSION"));
    const version = (0, fs_1.readText)((0, paths_1.frameworkVersionPath)()).trim();
    const typescriptVersion = JSON.parse((0, fs_1.readText)(node_path_1.default.join(typescriptPackage, "package.json"))).version;
    const manifest = { name: packageName, version, private: false, bin: { "pw-test-workspace": "dist/commands/testWorkspaceCli.js" }, dependencies: { typescript: typescriptVersion }, files: ["dist/", "framework/"] };
    (0, fs_1.writeManagedFile)(node_path_1.default.join(output, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`, action === "build" ? "new" : "overwrite");
    (0, fs_1.writeManagedFile)(node_path_1.default.join(output, "pw-test-workspace.cmd"), "@echo off\r\nnode \"%~dp0dist\\commands\\testWorkspaceCli.js\" %*\r\n", action === "build" ? "new" : "overwrite");
}
function createZip(source, target) {
    const script = "$ErrorActionPreference='Stop'; Compress-Archive -Path (Join-Path $env:AIPROD_TEST_RELEASE_SOURCE '*') -DestinationPath $env:AIPROD_TEST_RELEASE_TARGET -CompressionLevel Optimal";
    const result = (0, node_child_process_1.spawnSync)("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
        encoding: "utf8",
        env: { ...process.env, AIPROD_TEST_RELEASE_SOURCE: source, AIPROD_TEST_RELEASE_TARGET: target },
    });
    if (result.status !== 0)
        throw new Error(`ZIP release creation failed: ${result.stderr || result.stdout || "unknown error"}`);
}
function testWorkspacePackageCommand(args) {
    const [action, target, ...rest] = args;
    if ((action !== "build" && action !== "update" && action !== "release") || !target || rest.length)
        throw new Error("test-workspace-package requires build <empty_output_path>, update <package_path>, or release <new_zip_path>");
    const output = node_path_1.default.resolve(target);
    if (action !== "release") {
        populatePackage(output, action);
        console.log(JSON.stringify({ ok: true, action, output, command: `node ${JSON.stringify(node_path_1.default.join(output, "dist", "commands", "testWorkspaceCli.js"))} init <workspace_path>` }, null, 2));
        return 0;
    }
    if (node_path_1.default.extname(output).toLowerCase() !== ".zip")
        throw new Error("release target must end with .zip");
    if (node_fs_1.default.existsSync(output))
        throw new Error(`Release ZIP already exists: ${output}`);
    if (!node_fs_1.default.existsSync(node_path_1.default.dirname(output)))
        (0, fs_1.ensureDir)(node_path_1.default.dirname(output));
    const temporary = node_fs_1.default.mkdtempSync(node_path_1.default.join(node_path_1.default.dirname(output), ".pw-test-workspace-release-"));
    try {
        populatePackage(temporary, "build");
        createZip(temporary, output);
    }
    finally {
        node_fs_1.default.rmSync(temporary, { recursive: true, force: true });
    }
    console.log(JSON.stringify({ ok: true, action, output, command: "pw-test-workspace.cmd init <workspace_path>" }, null, 2));
    return 0;
}
