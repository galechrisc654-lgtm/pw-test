"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCommand = updateCommand;
const update_1 = require("../core/update");
const paths_1 = require("../core/paths");
function updateCommand(args) {
    const projectRoot = (0, paths_1.resolveProjectPath)(args[0]);
    console.log(JSON.stringify((0, update_1.updateProject)(projectRoot), null, 2));
    return 0;
}
