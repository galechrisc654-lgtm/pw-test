"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initCommand = initCommand;
const scaffold_1 = require("../core/scaffold");
const paths_1 = require("../core/paths");
function initCommand(args) {
    const projectRoot = (0, paths_1.resolveProjectPath)(args[0]);
    console.log(JSON.stringify((0, scaffold_1.initProject)(projectRoot), null, 2));
    return 0;
}
