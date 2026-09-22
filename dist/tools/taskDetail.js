"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskDetailTool = void 0;
const tasks_1 = require("../core/tasks");
exports.taskDetailTool = {
    name: "task_detail",
    run: async (args, context) => {
        const [taskId, ...unknown] = args;
        if (!taskId)
            throw new Error("task_detail requires task_id");
        if (unknown.length > 0)
            throw new Error(`Unknown task_detail arguments: ${unknown.join(" ")}`);
        const task = (0, tasks_1.getWorkspaceTask)(context.projectRoot, taskId);
        console.log(JSON.stringify({
            ok: true,
            project_root: context.projectRoot,
            task,
        }, null, 2));
        return 0;
    },
};
