"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskListTool = void 0;
const tasks_1 = require("../core/tasks");
const args_1 = require("./args");
exports.taskListTool = {
    name: "task_list",
    run: async (args, context) => {
        const rest = [...args];
        const status = (0, args_1.consumeOption)(rest, "--status");
        if (rest.length > 0)
            throw new Error(`Unknown task_list arguments: ${rest.join(" ")}`);
        const tasks = (0, tasks_1.listWorkspaceTasks)(context.projectRoot)
            .filter((task) => !status || task.status === status)
            .map(({ content: _content, ...task }) => task);
        console.log(JSON.stringify({
            ok: true,
            project_root: context.projectRoot,
            count: tasks.length,
            tasks,
        }, null, 2));
        return 0;
    },
};
