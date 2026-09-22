"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findTool = findTool;
const agentRunLogger_1 = require("./agentRunLogger");
const apiContractRegistry_1 = require("./apiContractRegistry");
const documentSyncRelationUpdater_1 = require("./documentSyncRelationUpdater");
const deliveryTestReport_1 = require("./deliveryTestReport");
const informationDensityEvaluator_1 = require("./informationDensityEvaluator");
const integrationResolver_1 = require("./integrationResolver");
const karateTestAssetCheck_1 = require("./karateTestAssetCheck");
const karateTestRun_1 = require("./karateTestRun");
const playwrightTestAssetCheck_1 = require("./playwrightTestAssetCheck");
const playwrightTestRun_1 = require("./playwrightTestRun");
const playwrightAgentsInit_1 = require("./playwrightAgentsInit");
const playwrightRuntime_1 = require("./playwrightRuntime");
const openapiDocumentBuilder_1 = require("./openapiDocumentBuilder");
const openapiFetcher_1 = require("./openapiFetcher");
const taskDetail_1 = require("./taskDetail");
const taskList_1 = require("./taskList");
const taskStatusUpdater_1 = require("./taskStatusUpdater");
const tools = [
    integrationResolver_1.integrationResolverTool,
    karateTestAssetCheck_1.karateTestAssetCheckTool,
    karateTestRun_1.karateTestRunTool,
    playwrightTestAssetCheck_1.playwrightTestAssetCheckTool,
    playwrightTestRun_1.playwrightTestRunTool,
    playwrightAgentsInit_1.playwrightAgentsInitTool,
    playwrightRuntime_1.playwrightRuntimeTool,
    openapiFetcher_1.openapiFetcherTool,
    apiContractRegistry_1.apiContractRegistryTool,
    openapiDocumentBuilder_1.openapiDocumentBuilderTool,
    taskList_1.taskListTool,
    taskDetail_1.taskDetailTool,
    taskStatusUpdater_1.taskStatusUpdaterTool,
    documentSyncRelationUpdater_1.documentSyncRelationUpdaterTool,
    deliveryTestReport_1.deliveryTestReportTool,
    agentRunLogger_1.agentRunLoggerTool,
    informationDensityEvaluator_1.informationDensityEvaluatorTool,
];
function findTool(name) {
    return tools.find((tool) => tool.name === name);
}
