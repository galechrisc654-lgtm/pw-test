"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findTestWorkspaceTool = findTestWorkspaceTool;
const apiContractRegistry_1 = require("./apiContractRegistry");
const deliveryTestReport_1 = require("./deliveryTestReport");
const integrationResolver_1 = require("./integrationResolver");
const openapiDocumentBuilder_1 = require("./openapiDocumentBuilder");
const openapiFetcher_1 = require("./openapiFetcher");
const playwrightAgentsInit_1 = require("./playwrightAgentsInit");
const playwrightRuntime_1 = require("./playwrightRuntime");
const playwrightTestAssetCheck_1 = require("./playwrightTestAssetCheck");
const playwrightTestRun_1 = require("./playwrightTestRun");
const testWorkspaceTools = [
    integrationResolver_1.integrationResolverTool, openapiFetcher_1.openapiFetcherTool, openapiDocumentBuilder_1.openapiDocumentBuilderTool, apiContractRegistry_1.apiContractRegistryTool,
    playwrightTestAssetCheck_1.playwrightTestAssetCheckTool, playwrightTestRun_1.playwrightTestRunTool, playwrightRuntime_1.playwrightRuntimeTool, playwrightAgentsInit_1.playwrightAgentsInitTool, deliveryTestReport_1.deliveryTestReportTool,
];
function findTestWorkspaceTool(name) {
    return testWorkspaceTools.find((tool) => tool.name === name);
}
