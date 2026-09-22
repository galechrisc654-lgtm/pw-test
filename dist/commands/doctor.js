"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.doctorCommand = doctorCommand;
const doctor_1 = require("../core/doctor");
const paths_1 = require("../core/paths");
function doctorCommand(args) {
    const projectRoot = (0, paths_1.resolveProjectPath)(args[0]);
    const report = (0, doctor_1.doctorProject)(projectRoot);
    console.log(JSON.stringify(report, null, 2));
    return report.ok ? 0 : 1;
}
