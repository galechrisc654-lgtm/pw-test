"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCommand = runCommand;
const paths_1 = require("../core/paths");
const registry_1 = require("../tools/registry");
function consumeProjectRoot(args) {
    const rest = [...args];
    let projectRoot = process.cwd();
    const index = rest.indexOf("--project-root");
    if (index >= 0) {
        const value = rest[index + 1];
        if (!value)
            throw new Error("--project-root requires a value");
        projectRoot = value;
        rest.splice(index, 2);
    }
    return { projectRoot: (0, paths_1.resolveProjectPath)(projectRoot), rest };
}
async function runCommand(args) {
    const toolName = args[0];
    if (!toolName)
        throw new Error("run requires a tool name");
    const tool = (0, registry_1.findTool)(toolName);
    if (!tool)
        throw new Error(`Unknown tool: ${toolName}`);
    const { projectRoot, rest } = consumeProjectRoot(args.slice(1));
    return await tool.run(rest, { projectRoot });
}
