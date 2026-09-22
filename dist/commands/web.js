"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webCommand = webCommand;
const server_1 = require("../web/server");
function webCommand(args) {
    return (0, server_1.startWebConsole)(args);
}
