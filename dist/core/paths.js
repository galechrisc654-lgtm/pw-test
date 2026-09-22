"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiprodRoot = aiprodRoot;
exports.frameworkRoot = frameworkRoot;
exports.frameworkVersionPath = frameworkVersionPath;
exports.frameworkAiprodDir = frameworkAiprodDir;
exports.scaffoldDir = scaffoldDir;
exports.testScaffoldDir = testScaffoldDir;
exports.resolveProjectPath = resolveProjectPath;
exports.toDisplayPath = toDisplayPath;
const node_path_1 = __importDefault(require("node:path"));
function aiprodRoot() {
    return node_path_1.default.resolve(__dirname, "..", "..");
}
function frameworkRoot() {
    return node_path_1.default.join(aiprodRoot(), "framework");
}
function frameworkVersionPath() {
    return node_path_1.default.join(frameworkRoot(), "VERSION");
}
function frameworkAiprodDir() {
    return node_path_1.default.join(frameworkRoot(), "_aiprod");
}
function scaffoldDir() {
    return node_path_1.default.join(frameworkRoot(), "scaffold");
}
function testScaffoldDir() {
    return node_path_1.default.join(frameworkRoot(), "test-scaffold");
}
function resolveProjectPath(input) {
    return node_path_1.default.resolve(input ?? process.cwd());
}
function toDisplayPath(target, base) {
    return node_path_1.default.relative(base, target) || ".";
}
