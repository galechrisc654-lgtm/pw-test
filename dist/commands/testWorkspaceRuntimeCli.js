#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const paths_1 = require("../core/paths");
const testWorkspaceRegistry_1 = require("../tools/testWorkspaceRegistry");
const permittedTools = new Set([
    "integration_resolver", "openapi_fetcher", "openapi_document_builder", "api_contract_registry",
    "playwright_test_asset_check", "playwright_test_run", "playwright_runtime", "playwright_agents_init", "delivery_test_report",
]);
function projectContext(args) {
    const rest = [...args];
    const index = rest.indexOf("--project-root");
    const projectRoot = index < 0 ? process.cwd() : rest[index + 1];
    if (!projectRoot)
        throw new Error("--project-root requires a value");
    if (index >= 0)
        rest.splice(index, 2);
    return { projectRoot: (0, paths_1.resolveProjectPath)(projectRoot), rest };
}
async function main(args) {
    if (args[0] !== "run" || !args[1])
        throw new Error("Only run <test_tool> is available in this test workspace runtime");
    const toolName = args[1];
    if (!permittedTools.has(toolName))
        throw new Error(`Tool is not available in this test workspace runtime: ${toolName}`);
    const tool = (0, testWorkspaceRegistry_1.findTestWorkspaceTool)(toolName);
    if (!tool)
        throw new Error(`Test runtime tool is unavailable: ${toolName}`);
    const { projectRoot, rest } = projectContext(args.slice(2));
    return await tool.run(rest, { projectRoot });
}
main(process.argv.slice(2)).then((code) => { process.exitCode = code; }).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
