"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deliveryTestReportTool = void 0;
exports.appendDeliveryTestRun = appendDeliveryTestRun;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const args_1 = require("./args");
const BUG_TYPES = new Set(["代码核查", "功能测试"]);
const BUG_STATUSES = new Set(["待审核", "待修复", "待复测", "已通过", "已关闭", "不处理"]);
const TEST_CASE_STATUSES = new Set(["not_run", "passed", "failed", "blocked", "skipped", "not_api_testable"]);
const TERMINAL_TEST_CASE_STATUSES = new Set(["passed", "failed", "blocked", "skipped", "not_api_testable"]);
const TEST_RUN_RESULTS = new Set(["passed", "failed"]);
const BUG_COLUMNS = ["BUG ID", "类型", "问题说明", "系统单据", "框架内依据", "状态", "创建时间", "最近验证", "备注"];
const CASE_COLUMNS = ["用例 ID", "用例名称", "当前状态", "最近 Test Run", "备注"];
const BUG_MARKER = "<!-- delivery_test_report:bug-list-end -->";
const CASE_MARKER = "<!-- delivery_test_report:test-cases-end -->";
const RUN_MARKER = "<!-- delivery_test_report:test-runs-end -->";
const BASIS_START_MARKER = "<!-- delivery_test_report:test-basis-start -->";
const BASIS_MARKER = "<!-- delivery_test_report:test-basis-end -->";
function nowText() { const now = new Date(); const date = [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((value) => String(value).padStart(2, "0")).join("-"); const time = [now.getHours(), now.getMinutes()].map((value) => String(value).padStart(2, "0")).join(":"); return `${date} ${time}`; }
function required(value, name) { if (!value?.trim())
    throw new Error(`${name} is required`); return value.trim(); }
function singleId(value, option) { if (value.includes("/") || value.includes("\\") || value === "." || value === "..")
    throw new Error(`${option} must be a single stable ID`); return value; }
function scope(args, projectRoot) {
    const engineValue = (0, args_1.consumeOption)(args, "--engine") ?? "ka";
    if (engineValue !== "ka" && engineValue !== "pw")
        throw new Error("--engine must be ka or pw");
    const engine = engineValue;
    const change = (0, args_1.consumeOption)(args, "--change");
    const testingDir = (0, args_1.consumeOption)(args, "--testing-dir");
    if (Boolean(change) === Boolean(testingDir))
        throw new Error("Provide exactly one of --change or --testing-dir");
    if (change) {
        const id = singleId(required(change, "--change"), "--change");
        const relativeDirectory = `changes/${id}/testing-${engine}`;
        return { directory: node_path_1.default.join(projectRoot, ...relativeDirectory.split("/")), relativeDirectory, id, kind: "change", engine };
    }
    const normalized = required(testingDir, "--testing-dir").replace(/\\/g, "/").replace(/\/$/, "");
    const match = /^work\/testing\/([A-Za-z0-9][A-Za-z0-9_-]*)$/.exec(normalized);
    if (!match)
        throw new Error("--testing-dir must be work/testing/{test_id}");
    const relativeDirectory = engine === "pw" ? `${normalized}/testing-pw` : normalized;
    return { directory: node_path_1.default.join(projectRoot, ...relativeDirectory.split("/")), relativeDirectory, id: match[1], kind: "independent", engine };
}
function reportPaths(scope) { return { report: node_path_1.default.join(scope.directory, "test-report.md"), runs: node_path_1.default.join(scope.directory, "test-runs.md") }; }
function cell(value) { return value.trim().replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>"); }
function splitRow(line) { const trimmed = line.trim(); if (!trimmed.startsWith("|") || !trimmed.endsWith("|"))
    throw new Error(`Invalid Markdown table row: ${line}`); const result = []; let value = ""; let escaped = false; for (const character of trimmed.slice(1, -1)) {
    if (escaped) {
        value += character;
        escaped = false;
    }
    else if (character === "\\")
        escaped = true;
    else if (character === "|") {
        result.push(value.trim());
        value = "";
    }
    else
        value += character;
} if (escaped)
    value += "\\"; result.push(value.trim()); return result; }
function bugRow(bug) { return `| ${[bug.id, bug.type, bug.description, bug.systemRecord, bug.frameworkEvidence, bug.status, bug.createdAt, bug.latestVerification, bug.remark].map(cell).join(" | ")} |`; }
function caseRow(item) { return `| ${[item.id, item.name, item.status, item.latestRun, item.remark].map(cell).join(" | ")} |`; }
function count(bugs, status) { return bugs.filter((bug) => bug.status === status).length; }
function stats(bugs) { const pending = bugs.filter((bug) => bug.status !== "已关闭" && bug.status !== "不处理").length; return ["## BUG 统计", "", "| 总数 | 待审核 | 待修复 | 待复测 | 已通过 | 已关闭 | 不处理 | 未处理 |", "| --- | --- | --- | --- | --- | --- | --- | --- |", `| ${bugs.length} | ${count(bugs, "待审核")} | ${count(bugs, "待修复")} | ${count(bugs, "待复测")} | ${count(bugs, "已通过")} | ${count(bugs, "已关闭")} | ${count(bugs, "不处理")} | ${pending} |`, "", ""].join("\n"); }
function escapedTitle(title) { return title.replaceAll("\\", "\\\\").replaceAll("\"", "\\\""); }
function scopeFrontmatter(scope) { return scope.kind === "change" ? `change_id: ${scope.id}` : `testing_id: ${scope.id}`; }
function defaultTitle(scope) { return `${scope.id} 测试报告`; }
function relatedChanges(scope, values) { return [...new Set([...(scope.kind === "change" ? [scope.id] : []), ...values.map((value) => singleId(value, "--basis-change"))])]; }
function relationLinks(projectRoot, changeId) { const file = node_path_1.default.join(projectRoot, "work", "document_sync", "relations.json"); if (!node_fs_1.default.existsSync(file))
    return []; try {
    const parsed = JSON.parse(node_fs_1.default.readFileSync(file, "utf8"));
    const prdPath = `changes/${changeId}/requirements/prd.md`;
    return (parsed.relations ?? []).filter((item) => item.local_path === prdPath && typeof item.feishu_url === "string" && /^https:\/\//.test(item.feishu_url)).map((item) => item.feishu_url);
}
catch {
    return [];
} }
function testBasis(projectRoot, changeIds) { return changeIds.flatMap((id) => relationLinks(projectRoot, id)).map((url) => `飞书文档：${url}`).join("\n"); }
function relatedChangesFromReport(document) { const match = /^related_change_ids:\s*(\[[^\r\n]*\])\s*$/m.exec(document); if (!match)
    throw new Error("test-report.md is missing related_change_ids"); try {
    const values = JSON.parse(match[1]);
    if (!Array.isArray(values) || values.some((value) => typeof value !== "string"))
        throw new Error();
    return [...new Set(values.map((value) => singleId(value, "related_change_ids")))];
}
catch {
    throw new Error("test-report.md related_change_ids is malformed");
} }
function updateBasis(document, projectRoot, changeIds, timestamp) { const start = document.indexOf(BASIS_START_MARKER); const marker = document.indexOf(BASIS_MARKER); if (start < 0 || marker < 0 || marker < start)
    throw new Error("test-report.md test basis is malformed"); const content = testBasis(projectRoot, changeIds); const next = `${document.slice(0, start + BASIS_START_MARKER.length)}\n${content ? `${content}\n` : ""}${BASIS_MARKER}${document.slice(marker + BASIS_MARKER.length)}`; return next === document ? document : updateTimestamp(next, timestamp); }
function reportDocument(scope, title, timestamp, changeIds, projectRoot, cases) { const basis = testBasis(projectRoot, changeIds); const caseRows = cases.map(caseRow).join("\n"); return `---\nid: delivery_test_report\ntype: delivery_test_report\n${scopeFrontmatter(scope)}\nrelated_change_ids: ${JSON.stringify(changeIds)}\ntitle: \"${escapedTitle(title)}\"\ncreated_at: \"${timestamp}\"\nupdated_at: \"${timestamp}\"\n---\n\n# ${title}\n\n${BASIS_START_MARKER}\n${basis ? `${basis}\n` : ""}${BASIS_MARKER}\n\n## 测试用例状态\n\n| ${CASE_COLUMNS.join(" | ")} |\n| --- | --- | --- | --- | --- |\n${caseRows ? `${caseRows}\n` : ""}${CASE_MARKER}\n\n${stats([])}## BUG 列表\n\n| ${BUG_COLUMNS.join(" | ")} |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n${BUG_MARKER}\n`; }
function testRunsDocument(scope, timestamp) { return `---\nid: test_run_summary\ntype: test_run_summary\n${scopeFrontmatter(scope)}\ncreated_at: \"${timestamp}\"\nupdated_at: \"${timestamp}\"\n---\n\n# 测试运行汇总\n\n| Test Run | 时间 | 范围 | 结果 | 原生报告入口 |\n| --- | --- | --- | --- | --- |\n${RUN_MARKER}\n`; }
function updateTimestamp(document, timestamp) { if (!/^---\r?\n[\s\S]*?\r?\n---/.test(document))
    throw new Error("Report must start with frontmatter"); return /^updated_at\s*:/m.test(document) ? document.replace(/^updated_at\s*:.*$/m, `updated_at: \"${timestamp}\"`) : document.replace(/^---\r?\n/, `---\nupdated_at: \"${timestamp}\"\n`); }
function writeAtomic(file, content) { const temporary = `${file}.tmp-${process.pid}`; node_fs_1.default.writeFileSync(temporary, content, "utf8"); node_fs_1.default.renameSync(temporary, file); }
function readReport(file) { if (!node_fs_1.default.existsSync(file))
    throw new Error(`Delivery test report not found: ${file}`); const document = node_fs_1.default.readFileSync(file, "utf8"); if (!document.includes(BUG_MARKER))
    throw new Error("test-report.md is not managed by delivery_test_report"); return document; }
function sourceTestCases(scope, allowUnreviewed = false) { const file = node_path_1.default.join(scope.directory, "test-cases.md"); if (!node_fs_1.default.existsSync(file))
    return []; const document = node_fs_1.default.readFileSync(file, "utf8"); if (!/^>\s*审核状态：\s*已审核\s*$/m.test(document)) {
    if (allowUnreviewed)
        return [];
    throw new Error(`${scope.relativeDirectory}/test-cases.md must be explicitly marked 审核状态：已审核 before it can drive testing`);
} const cases = []; const seen = new Set(); for (const match of document.matchAll(/^#{1,6}\s+(TC-[A-Za-z0-9_-]+)\s+(.+?)\s*$/gm)) {
    const id = match[1];
    if (seen.has(id))
        throw new Error(`test-cases.md contains duplicate case ID: ${id}`);
    seen.add(id);
    cases.push({ id, name: match[2].trim(), status: "not_run", latestRun: "", remark: "" });
} return cases; }
function reportTestCases(document) { const start = document.indexOf(`| ${CASE_COLUMNS.join(" | ")} |`); const marker = document.indexOf(CASE_MARKER); if (start < 0 || marker < 0 || marker < start)
    throw new Error("test-report.md test case section is malformed"); const section = document.slice(start, marker).trim().split(/\r?\n/); return section.slice(2).filter((line) => line.trim()).map((line) => { const values = splitRow(line); if (values.length !== CASE_COLUMNS.length)
    throw new Error("test case row is malformed"); return { id: values[0], name: values[1], status: values[2], latestRun: values[3], remark: values[4] }; }); }
function replaceTestCases(document, cases, timestamp) { const start = document.indexOf(`| ${CASE_COLUMNS.join(" | ")} |`); const marker = document.indexOf(CASE_MARKER); const separatorStart = document.indexOf("| --- | --- | --- | --- | --- |", start); const rowsStart = document.indexOf("\n", separatorStart) + 1; if (start < 0 || marker < 0 || separatorStart < 0 || rowsStart <= 0 || rowsStart > marker)
    throw new Error("test-report.md test case section is malformed"); const rows = cases.map(caseRow).join("\n"); return updateTimestamp(`${document.slice(0, rowsStart)}${rows ? `${rows}\n` : ""}${document.slice(marker)}`, timestamp); }
function parseBugs(document) { const start = document.indexOf(`| ${BUG_COLUMNS.join(" | ")} |`); const end = document.indexOf(BUG_MARKER); if (start < 0 || end < 0 || end < start)
    throw new Error("test-report.md BUG list is malformed"); const section = document.slice(start, end).trim().split(/\r?\n/); if (section.length < 2)
    throw new Error("test-report.md BUG list is malformed"); return section.slice(2).filter((line) => line.trim()).map((line) => { const values = splitRow(line); if (values.length !== BUG_COLUMNS.length)
    throw new Error(`BUG list row must have ${BUG_COLUMNS.length} columns`); const [id, type, description, systemRecord, frameworkEvidence, status, createdAt, latestVerification, remark] = values; if (!BUG_TYPES.has(type) || !BUG_STATUSES.has(status))
    throw new Error(`BUG list contains an unsupported type or status: ${id}`); return { id, type: type, description, systemRecord, frameworkEvidence, status: status, createdAt, latestVerification, remark }; }); }
function writeReport(file, document, bugs, timestamp, dryRun) { const statsStart = document.indexOf("## BUG 统计"); const listStart = document.indexOf("## BUG 列表"); const markerIndex = document.indexOf(BUG_MARKER); if (statsStart < 0 || listStart < 0 || markerIndex < 0)
    throw new Error("test-report.md sections are malformed"); const withStats = `${document.slice(0, statsStart)}${stats(bugs)}${document.slice(listStart)}`; const nextMarker = withStats.indexOf(BUG_MARKER); const separator = "| --- | --- | --- | --- | --- | --- | --- | --- | --- |"; const separatorStart = withStats.indexOf(separator, withStats.indexOf("## BUG 列表")); const rowsStart = withStats.indexOf("\n", separatorStart) + 1; if (separatorStart < 0 || rowsStart <= 0 || rowsStart > nextMarker)
    throw new Error("test-report.md BUG list is malformed"); const rows = bugs.map(bugRow).join("\n"); const next = updateTimestamp(`${withStats.slice(0, rowsStart)}${rows ? `${rows}\n` : ""}${withStats.slice(nextMarker)}`, timestamp); if (!dryRun)
    node_fs_1.default.writeFileSync(file, next, "utf8"); }
function nextBugId(bugs) { const ids = bugs.map((bug) => /^BUG-(\d+)$/.exec(bug.id)?.[1]).filter((value) => Boolean(value)).map(Number); return `BUG-${String((ids.length ? Math.max(...ids) : 0) + 1).padStart(3, "0")}`; }
function containsAbsolutePath(value) { return /(?:[A-Za-z]:[\\/]|(?:^|[\s(])\/(?!\/))/m.test(value); }
function containsRelativeCodePath(value) { return /(?:^|[\s（(【，,；;])(?:\.\/)?(?!\.\.?\/)(?:[A-Za-z0-9_.@+-]+\/)*[A-Za-z0-9_.@+-]+\.[A-Za-z][A-Za-z0-9]*(?:(?::|#L)\d+(?:-\d+)?)?(?=$|[\s）)】，,；;。])/m.test(value.replaceAll("`", "")); }
function assertCodeReviewDescription(description) {
    if (containsAbsolutePath(description))
        throw new Error("代码核查的 --description 不得包含绝对路径；请引用源码 Git 仓库根目录相对路径");
    if (!containsRelativeCodePath(description))
        throw new Error("代码核查的 --description 必须引用源码 Git 仓库根目录相对路径，建议带行号，例如 src/auth/permission.ts:42");
}
function assertNoAbsoluteCodePath(value, option) { if (containsAbsolutePath(value))
    throw new Error(`代码核查的 ${option} 不得包含绝对路径；请使用源码 Git 仓库根目录相对路径`); }
function transitionAllowed(from, to) { return from === to || (from === "待审核" && (to === "待修复" || to === "不处理")) || (from === "待修复" && to === "待复测") || (from === "待复测" && (to === "待修复" || to === "已通过")) || (from === "已通过" && (to === "待修复" || to === "已关闭")); }
function appendRemark(previous, next) { return previous ? `${previous}<br>${next}` : next; }
function init(args, projectRoot, dryRun) { const basisChanges = (0, args_1.consumeRepeatedOption)(args, "--basis-change"); const codeReviewIndex = args.indexOf("--code-review"); const codeReview = codeReviewIndex >= 0; if (codeReview)
    args.splice(codeReviewIndex, 1); const target = scope(args, projectRoot); const title = (0, args_1.consumeOption)(args, "--title")?.trim() || defaultTitle(target); if (args.length)
    throw new Error(`Unknown delivery_test_report init arguments: ${args.join(" ")}`); const paths = reportPaths(target); if (node_fs_1.default.existsSync(paths.report) || node_fs_1.default.existsSync(paths.runs))
    throw new Error("A delivery test report or test-run summary already exists; this tool does not overwrite existing records"); const timestamp = nowText(); const changeIds = relatedChanges(target, basisChanges); const cases = sourceTestCases(target, codeReview); if (!dryRun) {
    node_fs_1.default.mkdirSync(target.directory, { recursive: true });
    node_fs_1.default.writeFileSync(paths.report, reportDocument(target, title, timestamp, changeIds, projectRoot, cases), "utf8");
    node_fs_1.default.writeFileSync(paths.runs, testRunsDocument(target, timestamp), "utf8");
} console.log(JSON.stringify({ ok: true, dry_run: dryRun, action: "initialized", report: `${target.relativeDirectory}/test-report.md`, test_runs: `${target.relativeDirectory}/test-runs.md`, title, related_change_ids: changeIds, test_case_count: cases.length, code_review: codeReview }, null, 2)); return 0; }
function refreshBasis(args, projectRoot, dryRun) { const target = scope(args, projectRoot); if (args.length)
    throw new Error(`Unknown delivery_test_report refresh-basis arguments: ${args.join(" ")}`); const file = reportPaths(target).report; const report = readReport(file); const changeIds = relatedChangesFromReport(report); const next = updateBasis(report, projectRoot, changeIds, nowText()); if (!dryRun && next !== report)
    node_fs_1.default.writeFileSync(file, next, "utf8"); console.log(JSON.stringify({ ok: true, dry_run: dryRun, action: "test_basis_refreshed", report: `${target.relativeDirectory}/test-report.md`, related_change_ids: changeIds, changed: next !== report }, null, 2)); return 0; }
function updateTestCase(args, projectRoot, dryRun) { const target = scope(args, projectRoot); const id = required((0, args_1.consumeOption)(args, "--case"), "--case"); const name = required((0, args_1.consumeOption)(args, "--name"), "--name"); const status = required((0, args_1.consumeOption)(args, "--status"), "--status"); const latestRun = (0, args_1.consumeOption)(args, "--latest-run") ?? ""; const remark = (0, args_1.consumeOption)(args, "--remark") ?? ""; if (!TEST_CASE_STATUSES.has(status))
    throw new Error("--status must be not_run, passed, failed, blocked, skipped or not_api_testable"); if ((status === "passed" || status === "failed") && !latestRun.trim())
    throw new Error("--latest-run is required for passed or failed"); if ((status === "blocked" || status === "skipped" || status === "not_api_testable") && !remark.trim())
    throw new Error(`--remark is required for ${status}`); if (args.length)
    throw new Error(`Unknown delivery_test_report update-test-case arguments: ${args.join(" ")}`); const file = reportPaths(target).report; const report = readReport(file); const cases = reportTestCases(report); const nextCase = { id, name, status, latestRun, remark }; const index = cases.findIndex((item) => item.id === id); if (index >= 0)
    cases[index] = nextCase;
else
    cases.push(nextCase); const next = replaceTestCases(report, cases, nowText()); if (!dryRun)
    node_fs_1.default.writeFileSync(file, next, "utf8"); console.log(JSON.stringify({ ok: true, dry_run: dryRun, action: "test_case_updated", test_case: nextCase, report: `${target.relativeDirectory}/test-report.md` }, null, 2)); return 0; }
function syncTestCases(args, projectRoot, dryRun) { const target = scope(args, projectRoot); if (args.length)
    throw new Error(`Unknown delivery_test_report sync-test-cases arguments: ${args.join(" ")}`); const sourceCases = sourceTestCases(target); if (sourceCases.length === 0)
    throw new Error(`No test cases found in ${target.relativeDirectory}/test-cases.md`); const file = reportPaths(target).report; const report = readReport(file); const existing = new Map(reportTestCases(report).map((item) => [item.id, item])); const cases = sourceCases.map((item) => ({ ...item, ...(existing.get(item.id) ?? {}), name: item.name })); const removedCaseIds = [...existing.keys()].filter((id) => !sourceCases.some((item) => item.id === id)); const next = replaceTestCases(report, cases, nowText()); if (!dryRun && next !== report)
    node_fs_1.default.writeFileSync(file, next, "utf8"); console.log(JSON.stringify({ ok: true, dry_run: dryRun, action: "test_cases_synced", report: `${target.relativeDirectory}/test-report.md`, test_case_count: cases.length, added_case_ids: cases.filter((item) => !existing.has(item.id)).map((item) => item.id), removed_case_ids: removedCaseIds, changed: next !== report }, null, 2)); return 0; }
function compactIds(values) { const limit = 20; return { ids: values.slice(0, limit), omitted: Math.max(0, values.length - limit) }; }
function summary(args, projectRoot) { const target = scope(args, projectRoot); if (args.length)
    throw new Error(`Unknown delivery_test_report summary arguments: ${args.join(" ")}`); const paths = reportPaths(target); const report = readReport(paths.report); const sourceCases = sourceTestCases(target); const reportCases = reportTestCases(report); const reportMap = new Map(reportCases.map((item) => [item.id, item])); const missing = sourceCases.filter((item) => !reportMap.has(item.id)).map((item) => item.id); const extra = reportCases.filter((item) => !sourceCases.some((source) => source.id === item.id)).map((item) => item.id); const incomplete = sourceCases.filter((item) => { const current = reportMap.get(item.id); return !current || !TERMINAL_TEST_CASE_STATUSES.has(current.status); }).map((item) => item.id); const caseCounts = reportCases.reduce((result, item) => { result[item.status] = (result[item.status] ?? 0) + 1; return result; }, {}); const bugs = parseBugs(report); const bugCounts = bugs.reduce((result, item) => { result[item.status] = (result[item.status] ?? 0) + 1; return result; }, {}); const runCount = node_fs_1.default.existsSync(paths.runs) ? node_fs_1.default.readFileSync(paths.runs, "utf8").split(/\r?\n/).filter((line) => /^\|\s*TR-[^|]+\|/.test(line)).length : 0; console.log(JSON.stringify({ ok: true, action: "summary", scope: target.relativeDirectory, complete: sourceCases.length > 0 && incomplete.length === 0 && missing.length === 0 && extra.length === 0, test_cases: { source_total: sourceCases.length, report_total: reportCases.length, status_counts: caseCounts, incomplete: compactIds(incomplete), missing: compactIds(missing), extra: compactIds(extra) }, bugs: { total: bugs.length, status_counts: bugCounts }, test_runs: { total: runCount } })); return 0; }
function addBug(args, projectRoot, dryRun) { const target = scope(args, projectRoot); const type = required((0, args_1.consumeOption)(args, "--type"), "--type"); const description = required((0, args_1.consumeOption)(args, "--description"), "--description"); const systemRecord = (0, args_1.consumeOption)(args, "--system-record") ?? ""; const frameworkEvidence = required((0, args_1.consumeOption)(args, "--framework-evidence"), "--framework-evidence"); const relatedBug = (0, args_1.consumeOption)(args, "--related-bug"); if (!BUG_TYPES.has(type))
    throw new Error("--type must be 代码核查 or 功能测试"); if (type === "代码核查") {
    assertCodeReviewDescription(description);
    assertNoAbsoluteCodePath(frameworkEvidence, "--framework-evidence");
} if (args.length)
    throw new Error(`Unknown delivery_test_report add-bug arguments: ${args.join(" ")}`); const file = reportPaths(target).report; const report = readReport(file); const bugs = parseBugs(report); if (relatedBug) {
    const related = bugs.find((bug) => bug.id === relatedBug);
    if (!related || related.status !== "已关闭")
        throw new Error("--related-bug must reference an 已关闭 BUG");
} const timestamp = nowText(); const bug = { id: nextBugId(bugs), type, description, systemRecord, frameworkEvidence, status: "待审核", createdAt: timestamp, latestVerification: "", remark: relatedBug ? `复发自 ${relatedBug}` : "" }; writeReport(file, report, [...bugs, bug], timestamp, dryRun); console.log(JSON.stringify({ ok: true, dry_run: dryRun, action: "bug_added", bug, report: `${target.relativeDirectory}/test-report.md` }, null, 2)); return 0; }
function updateBug(args, projectRoot, dryRun) { const target = scope(args, projectRoot); const id = required((0, args_1.consumeOption)(args, "--bug"), "--bug"); const statusValue = (0, args_1.consumeOption)(args, "--status"); const status = statusValue; const latestVerification = (0, args_1.consumeOption)(args, "--latest-verification"); const description = (0, args_1.consumeOption)(args, "--description"); const systemRecord = (0, args_1.consumeOption)(args, "--system-record"); const frameworkEvidence = (0, args_1.consumeOption)(args, "--framework-evidence"); const remark = (0, args_1.consumeOption)(args, "--remark"); if (!status && latestVerification === undefined && description === undefined && systemRecord === undefined && frameworkEvidence === undefined && remark === undefined)
    throw new Error("Provide --status, --description, --system-record, --framework-evidence, --remark or --latest-verification"); if (status && !BUG_STATUSES.has(status))
    throw new Error("--status must be 待审核, 待修复, 待复测, 已通过, 已关闭 or 不处理"); if (args.length)
    throw new Error(`Unknown delivery_test_report update-bug arguments: ${args.join(" ")}`); const file = reportPaths(target).report; const report = readReport(file); const bugs = parseBugs(report); const index = bugs.findIndex((bug) => bug.id === id); if (index < 0)
    throw new Error(`BUG not found: ${id}`); const current = bugs[index]; if (current.type === "代码核查") {
    if (description !== undefined)
        assertCodeReviewDescription(description);
    if (frameworkEvidence !== undefined)
        assertNoAbsoluteCodePath(frameworkEvidence, "--framework-evidence");
} const nextStatus = status ?? current.status; if (!transitionAllowed(current.status, nextStatus))
    throw new Error(`Invalid BUG status transition: ${current.status} -> ${nextStatus}`); if (nextStatus === "已关闭" && !(latestVerification ?? current.latestVerification).trim())
    throw new Error("--latest-verification is required when closing a BUG"); const next = [...bugs]; next[index] = { ...current, status: nextStatus, description: description ?? current.description, systemRecord: systemRecord ?? current.systemRecord, frameworkEvidence: frameworkEvidence ?? current.frameworkEvidence, remark: remark ?? current.remark, latestVerification: latestVerification ?? current.latestVerification }; writeReport(file, report, next, nowText(), dryRun); console.log(JSON.stringify({ ok: true, dry_run: dryRun, action: "bug_updated", bug: next[index], report: `${target.relativeDirectory}/test-report.md` }, null, 2)); return 0; }
function recordRetest(args, projectRoot, dryRun) { const target = scope(args, projectRoot); const id = required((0, args_1.consumeOption)(args, "--bug"), "--bug"); const runId = required((0, args_1.consumeOption)(args, "--run-id"), "--run-id"); const result = required((0, args_1.consumeOption)(args, "--result"), "--result"); const details = required((0, args_1.consumeOption)(args, "--details"), "--details"); if (result !== "passed" && result !== "failed")
    throw new Error("--result must be passed or failed"); if (args.length)
    throw new Error(`Unknown delivery_test_report record-retest arguments: ${args.join(" ")}`); const file = reportPaths(target).report; const report = readReport(file); const bugs = parseBugs(report); const index = bugs.findIndex((bug) => bug.id === id); if (index < 0)
    throw new Error(`BUG not found: ${id}`); const current = bugs[index]; if (current.status !== "待复测")
    throw new Error(`Only 待复测 BUGs can be retested: ${id} is ${current.status}`); const verification = `${runId}：${details}`; const next = [...bugs]; next[index] = { ...current, status: result === "passed" ? "已通过" : "待修复", latestVerification: verification, remark: result === "failed" ? appendRemark(current.remark, `复测不通过（${nowText()}）：${verification}`) : current.remark }; writeReport(file, report, next, nowText(), dryRun); console.log(JSON.stringify({ ok: true, dry_run: dryRun, action: "retest_recorded", bug: next[index], report: `${target.relativeDirectory}/test-report.md` }, null, 2)); return 0; }
function appendDeliveryTestRun(options) { const engine = options.engine ?? "ka"; const targetArgs = options.change ? ["--engine", engine, "--change", options.change] : ["--engine", engine, "--testing-dir", required(options.testingDir, "--testing-dir")]; const target = scope(targetArgs, options.projectRoot); const runId = singleId(required(options.runId, "--run-id"), "--run-id"); const runScope = required(options.runScope, "--scope"); const result = required(options.result, "--result"); if (!TEST_RUN_RESULTS.has(result))
    throw new Error("--result must be passed or failed"); const reportUrl = required(options.report, "--report").replace(/\\/g, "/"); const reportRoot = engine === "ka" ? "karate" : "playwright"; const reportName = engine === "ka" ? "karate-summary.html" : "index.html"; const engineLabel = engine === "ka" ? "Karate" : "Playwright"; const expectedPrefix = target.kind === "change" ? `.aiprod-local/test-reports/${reportRoot}/changes/${target.id}/runs/${runId}/raw/` : `.aiprod-local/test-reports/${reportRoot}/independent/${target.id}/runs/${runId}/raw/`; if (!reportUrl.startsWith(expectedPrefix) || node_path_1.default.posix.basename(reportUrl) !== reportName)
    throw new Error(`--report must be the ${engineLabel} summary for ${runId} under ${expectedPrefix}`); const reportFile = node_path_1.default.resolve(options.projectRoot, ...reportUrl.split("/")); const relativeReport = node_path_1.default.relative(options.projectRoot, reportFile); if (relativeReport.startsWith("..") || node_path_1.default.isAbsolute(relativeReport) || !node_fs_1.default.existsSync(reportFile) || !node_fs_1.default.statSync(reportFile).isFile())
    throw new Error(`${engineLabel} report not found inside project: ${reportUrl}`); const file = reportPaths(target).runs; if (!node_fs_1.default.existsSync(file))
    throw new Error(`Test-run summary not found: ${file}`); const document = node_fs_1.default.readFileSync(file, "utf8"); const marker = document.indexOf(RUN_MARKER); if (marker < 0)
    throw new Error("test-runs.md is not managed by delivery_test_report"); const existing = document.slice(0, marker).split(/\r?\n/).filter((line) => line.trim().startsWith("|")).map((line) => { try {
    return splitRow(line);
}
catch {
    return [];
} }).find((values) => values[0] === runId); if (existing) {
    const same = existing[2] === runScope && existing[3] === result && existing[4] === reportUrl;
    if (!same)
        throw new Error(`Test Run already exists with different data: ${runId}`);
    return { file: `${target.relativeDirectory}/test-runs.md`, appended: false };
} const timestamp = nowText(); const row = `| ${[runId, timestamp, runScope, result, reportUrl].map(cell).join(" | ")} |\n`; const next = updateTimestamp(`${document.slice(0, marker)}${row}${document.slice(marker)}`, timestamp); if (!options.dryRun)
    writeAtomic(file, next); return { file: `${target.relativeDirectory}/test-runs.md`, appended: true }; }
function appendTestRun(args, projectRoot, dryRun) { const engineValue = (0, args_1.consumeOption)(args, "--engine") ?? "ka"; if (engineValue !== "ka" && engineValue !== "pw")
    throw new Error("--engine must be ka or pw"); const change = (0, args_1.consumeOption)(args, "--change"); const testingDir = (0, args_1.consumeOption)(args, "--testing-dir"); const runId = required((0, args_1.consumeOption)(args, "--run-id"), "--run-id"); const runScope = required((0, args_1.consumeOption)(args, "--scope"), "--scope"); const result = required((0, args_1.consumeOption)(args, "--result"), "--result"); const report = required((0, args_1.consumeOption)(args, "--report"), "--report"); if (Boolean(change) === Boolean(testingDir))
    throw new Error("Provide exactly one of --change or --testing-dir"); if (args.length)
    throw new Error(`Unknown delivery_test_report append-test-run arguments: ${args.join(" ")}`); const recorded = appendDeliveryTestRun({ projectRoot, change, testingDir, engine: engineValue, runId, runScope, result, report, dryRun }); console.log(JSON.stringify({ ok: true, dry_run: dryRun, action: recorded.appended ? "test_run_appended" : "test_run_already_recorded", run_id: runId, file: recorded.file }, null, 2)); return 0; }
function listTestRuns(args, projectRoot) { const target = scope(args, projectRoot); const runId = (0, args_1.consumeOption)(args, "--run-id"); const limitValue = (0, args_1.consumeOption)(args, "--limit"); if (args.length)
    throw new Error(`Unknown delivery_test_report list-test-runs arguments: ${args.join(" ")}`); const limit = limitValue === undefined ? 5 : Number(limitValue); if (!Number.isInteger(limit) || limit < 1 || limit > 50)
    throw new Error("--limit must be an integer from 1 to 50"); const file = reportPaths(target).runs; if (!node_fs_1.default.existsSync(file))
    throw new Error(`Test-run summary not found: ${file}`); const document = node_fs_1.default.readFileSync(file, "utf8"); const marker = document.indexOf(RUN_MARKER); if (marker < 0)
    throw new Error("test-runs.md is not managed by delivery_test_report"); const rows = document.slice(0, marker).split(/\r?\n/).filter((line) => /^\|\s*TR-[^|]+\|/.test(line)).map((line) => { const values = splitRow(line); return { run_id: values[0], time: values[1], scope: values[2], result: values[3], report: values[4] }; }); const selected = runId ? rows.filter((item) => item.run_id === runId) : rows.slice(-limit).reverse(); console.log(JSON.stringify({ ok: true, action: "test_runs_listed", scope: target.relativeDirectory, total: rows.length, returned: selected.length, runs: selected })); return 0; }
exports.deliveryTestReportTool = { name: "delivery_test_report", run: async (args, context) => { const filtered = [...args]; const dryRunIndex = filtered.indexOf("--dry-run"); const dryRun = dryRunIndex >= 0; if (dryRun)
        filtered.splice(dryRunIndex, 1); const action = filtered.shift(); try {
        if (action === "init")
            return init(filtered, context.projectRoot, dryRun);
        if (action === "refresh-basis")
            return refreshBasis(filtered, context.projectRoot, dryRun);
        if (action === "sync-test-cases")
            return syncTestCases(filtered, context.projectRoot, dryRun);
        if (action === "summary")
            return summary(filtered, context.projectRoot);
        if (action === "list-test-runs")
            return listTestRuns(filtered, context.projectRoot);
        if (action === "update-test-case")
            return updateTestCase(filtered, context.projectRoot, dryRun);
        if (action === "add-bug")
            return addBug(filtered, context.projectRoot, dryRun);
        if (action === "update-bug")
            return updateBug(filtered, context.projectRoot, dryRun);
        if (action === "append-test-run")
            return appendTestRun(filtered, context.projectRoot, dryRun);
        if (action === "record-retest")
            return recordRetest(filtered, context.projectRoot, dryRun);
        throw new Error("delivery_test_report requires init, refresh-basis, sync-test-cases, summary, list-test-runs, update-test-case, add-bug, update-bug, append-test-run or record-retest");
    }
    catch (error) {
        console.log(JSON.stringify({ ok: false, dry_run: dryRun, error: error instanceof Error ? error.message : String(error) }, null, 2));
        return 1;
    } } };
