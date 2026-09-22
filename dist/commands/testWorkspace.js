"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testWorkspaceCommand = testWorkspaceCommand;
const paths_1 = require("../core/paths");
const testWorkspace_1 = require("../core/testWorkspace");
function testWorkspaceCommand(args) {
    const [action, target, ...rest] = args;
    if ((action !== "init" && action !== "update") || !target || rest.length)
        throw new Error("test-workspace requires init|update <workspace_path>");
    console.log(JSON.stringify((0, testWorkspace_1.provisionTestWorkspace)((0, paths_1.resolveProjectPath)(target), action), null, 2));
    return 0;
}
