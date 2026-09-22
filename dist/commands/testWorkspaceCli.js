#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testWorkspace_1 = require("./testWorkspace");
function printHelp() {
    console.log("Usage: pw-test-workspace <init|update> <workspace_path>");
}
try {
    const args = process.argv.slice(2);
    if (args[0] === "--help" || args[0] === "-h")
        printHelp();
    else
        process.exitCode = (0, testWorkspace_1.testWorkspaceCommand)(args);
}
catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
}
