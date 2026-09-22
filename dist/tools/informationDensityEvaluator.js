"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.informationDensityEvaluatorTool = void 0;
exports.runInformationDensityEvaluator = runInformationDensityEvaluator;
const node_path_1 = __importDefault(require("node:path"));
const fs_1 = require("../core/fs");
const args_1 = require("./args");
function isRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
const VAR_PATTERN = /\$\{([^}:]+)(?::([^}]+))?\}/g;
function resolveInputFile(projectRoot, file) {
    return node_path_1.default.isAbsolute(file) ? file : node_path_1.default.join(projectRoot, file);
}
function informationDensityPrompt(documentText) {
    return `你是一个文档信息密度评估器。

你的任务是根据给定评分规则，评价输入文档的信息密度，并给出可执行的优化建议。

核心定义：
信息密度 = 有效信息 ÷ 阅读成本。

有效信息指：读者读完后新增了事实、判断、关系、方法、规则、边界或问题。

评分维度：
1. 有新信息，0-2 分：判断每一段是否提供新事实、新判断、新方法、新规则、新边界或新问题。
2. 不重复，0-2 分：判断同一个意思是否只说一次；如果重复，是否补充了新条件、新场景或新结论。
3. 够具体，0-2 分：判断是否说明对象、动作、条件、范围、标准、例子，而不是使用空泛形容词。
4. 有关系，0-2 分：判断是否说明因果、对比、层级、流程、依赖、约束或边界，而不是孤立罗列。
5. 易吸收，0-2 分：判断结构是否清楚，是否先结论后解释，同类信息是否放在一起，标题是否能概括内容，读者是否能快速抓到重点。

总分解释：
9-10 分：高密度，基本每段都有价值，难以压缩。
7-8 分：较高密度，有效信息多，少量重复或空泛。
5-6 分：中等密度，方向清楚，但重复和泛化明显。
3-4 分：低密度，内容不少，但有效信息少。
0-2 分：很低密度，多为套话、重复、空泛描述。

评价要求：
- 必须严格按 5 个维度分别打分，每项只能是 0、1、2。
- 必须给出总分和等级。
- 必须指出主要扣分原因。
- 必须给出可执行优化建议，不要只说“更具体”“减少重复”。
- 如果文档中存在低密度表达，请摘出少量典型片段并说明问题。
- 如果可以优化，请给出改写示例。
- 不要为了礼貌而抬高分数。
- 不要评价作者，只评价文本。
- 如果输入内容太短，也要按标准评分，并说明不确定性。

输出必须使用 JSON，不要输出 JSON 以外的文字。

JSON 结构如下：

{
  "score": {
    "total": 0,
    "level": "",
    "dimensions": {
      "new_information": { "score": 0, "reason": "" },
      "non_repetition": { "score": 0, "reason": "" },
      "specificity": { "score": 0, "reason": "" },
      "relationships": { "score": 0, "reason": "" },
      "absorbability": { "score": 0, "reason": "" }
    }
  },
  "summary": {
    "overall_judgment": "",
    "main_strengths": [],
    "main_problems": []
  },
  "low_density_examples": [
    { "text": "", "problem": "", "suggested_direction": "" }
  ],
  "optimization_suggestions": [
    { "priority": "high", "problem": "", "action": "", "expected_effect": "" }
  ],
  "rewrite_examples": [
    { "before": "", "after": "", "why_better": "" }
  ],
  "final_advice": ""
}

待评价文档如下：

${documentText}`;
}
function envValue(names) {
    for (const name of names) {
        const value = process.env[name];
        if (value)
            return value;
    }
    return undefined;
}
function firstConfiguredUrl(configuredValue, envNames, fallback) {
    return configuredValue ?? envValue(["AIPROD_LLM_BASE_URL", ...envNames]) ?? fallback;
}
function resolveLocalLlmString(value, local, localPath) {
    return value.replace(VAR_PATTERN, (_full, kind, name) => {
        const key = name ?? "";
        if (kind === "env") {
            const env = process.env[key];
            if (env === undefined)
                throw new Error(`Environment variable not found: ${key}`);
            return env;
        }
        if (kind === "secret") {
            const secrets = isRecord(local.secrets) ? local.secrets : {};
            const secret = secrets[key];
            if (secret === undefined)
                throw new Error(`Secret not found in ${localPath}: ${key}`);
            return typeof secret === "string" ? resolveLocalLlmString(secret, local, localPath) : String(secret);
        }
        if (kind === "local") {
            const locals = isRecord(local.locals) ? local.locals : {};
            const localValue = locals[key];
            if (localValue === undefined)
                throw new Error(`Local value not found in ${localPath}: ${key}`);
            return typeof localValue === "string" ? resolveLocalLlmString(localValue, local, localPath) : String(localValue);
        }
        throw new Error(`Unsupported local LLM variable expression: ${kind}${key ? `:${key}` : ""}`);
    });
}
function readLocalLlmConfig(projectRoot) {
    const projectPath = node_path_1.default.join(projectRoot, "references", "integrations", "integrations.json");
    const project = (0, fs_1.readJson)(projectPath, false);
    const projectIntegrations = isRecord(project.integrations) ? project.integrations : {};
    const localPath = node_path_1.default.join(projectRoot, "references", "integrations", "secrets.local.json");
    const local = (0, fs_1.readJson)(localPath, false);
    const llm = isRecord(local.llm) ? local.llm : {};
    if (Object.keys(llm).length === 0 && isRecord(projectIntegrations.llm)) {
        throw new Error("LLM config was found at references/integrations/integrations.json integrations.llm, but information_density_evaluator reads local LLM config from references/integrations/secrets.local.json top-level llm. Move provider/model/base_url/api_key to secrets.local.json because API keys and local routing must not be committed.");
    }
    const read = (key) => {
        const value = llm[key];
        if (value === undefined || value === null)
            return undefined;
        if (typeof value !== "string")
            throw new Error(`secrets.local.json llm.${key} must be a string`);
        return resolveLocalLlmString(value, local, localPath);
    };
    return {
        provider: read("provider"),
        model: read("model"),
        baseUrl: read("base_url") ?? read("baseUrl"),
        apiKey: read("api_key") ?? read("apiKey"),
    };
}
async function postJson(url, headers, body) {
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
    });
    const text = await response.text();
    if (!response.ok) {
        throw new Error(`LLM request failed (${response.status}): ${text.slice(0, 500)}`);
    }
    return JSON.parse(text);
}
function parseJsonObject(text) {
    const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    try {
        return JSON.parse(trimmed);
    }
    catch {
        const start = trimmed.indexOf("{");
        const end = trimmed.lastIndexOf("}");
        if (start >= 0 && end > start) {
            return JSON.parse(trimmed.slice(start, end + 1));
        }
        throw new Error("Model response did not contain valid JSON");
    }
}
function textFromOpenAiResponse(value) {
    if (!isRecord(value))
        throw new Error("OpenAI response must be an object");
    const choices = Array.isArray(value.choices) ? value.choices : [];
    const first = isRecord(choices[0]) ? choices[0] : {};
    const message = isRecord(first.message) ? first.message : {};
    if (typeof message.content === "string")
        return message.content;
    throw new Error("OpenAI response missing choices[0].message.content");
}
function textFromGeminiResponse(value) {
    if (!isRecord(value))
        throw new Error("Gemini response must be an object");
    const candidates = Array.isArray(value.candidates) ? value.candidates : [];
    const first = isRecord(candidates[0]) ? candidates[0] : {};
    const content = isRecord(first.content) ? first.content : {};
    const parts = Array.isArray(content.parts) ? content.parts : [];
    return parts.map((part) => (isRecord(part) && typeof part.text === "string" ? part.text : "")).join("");
}
function textFromAnthropicResponse(value) {
    if (!isRecord(value))
        throw new Error("Anthropic response must be an object");
    const content = Array.isArray(value.content) ? value.content : [];
    return content.map((part) => (isRecord(part) && typeof part.text === "string" ? part.text : "")).join("");
}
async function callLlm(request) {
    if (request.provider === "openai" || request.provider === "openai-compatible") {
        const key = request.apiKey ?? (request.provider === "openai"
            ? envValue(["OPENAI_API_KEY", "AIPROD_LLM_API_KEY"])
            : envValue(["AIPROD_LLM_API_KEY", "OPENAI_API_KEY"]));
        if (!key)
            throw new Error(`${request.provider} requires OPENAI_API_KEY or AIPROD_LLM_API_KEY`);
        const baseUrl = request.provider === "openai"
            ? firstConfiguredUrl(request.baseUrl, ["OPENAI_BASE_URL", "AIPROD_OPENAI_BASE_URL"], "https://api.openai.com/v1")
            : firstConfiguredUrl(request.baseUrl, ["OPENAI_COMPATIBLE_BASE_URL"], "https://api.openai.com/v1");
        const data = await postJson(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
            Authorization: `Bearer ${key}`,
        }, {
            model: request.model,
            messages: [{ role: "user", content: request.prompt }],
            temperature: 0,
            response_format: { type: "json_object" },
        });
        return parseJsonObject(textFromOpenAiResponse(data));
    }
    if (request.provider === "gemini") {
        const key = request.apiKey ?? envValue(["GEMINI_API_KEY", "GOOGLE_API_KEY", "AIPROD_LLM_API_KEY"]);
        if (!key)
            throw new Error("gemini requires GEMINI_API_KEY, GOOGLE_API_KEY, or AIPROD_LLM_API_KEY");
        const baseUrl = firstConfiguredUrl(request.baseUrl, ["GEMINI_BASE_URL", "AIPROD_GEMINI_BASE_URL"], "https://generativelanguage.googleapis.com/v1beta");
        const data = await postJson(`${baseUrl.replace(/\/$/, "")}/models/${request.model}:generateContent?key=${encodeURIComponent(key)}`, {}, {
            contents: [{ role: "user", parts: [{ text: request.prompt }] }],
            generationConfig: {
                temperature: 0,
                responseMimeType: "application/json",
            },
        });
        return parseJsonObject(textFromGeminiResponse(data));
    }
    if (request.provider === "anthropic") {
        const key = request.apiKey ?? envValue(["ANTHROPIC_API_KEY", "AIPROD_LLM_API_KEY"]);
        if (!key)
            throw new Error("anthropic requires ANTHROPIC_API_KEY or AIPROD_LLM_API_KEY");
        const baseUrl = firstConfiguredUrl(request.baseUrl, ["ANTHROPIC_BASE_URL", "AIPROD_ANTHROPIC_BASE_URL"], "https://api.anthropic.com/v1");
        const data = await postJson(`${baseUrl.replace(/\/$/, "")}/messages`, {
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
        }, {
            model: request.model,
            max_tokens: 4000,
            temperature: 0,
            messages: [{ role: "user", content: request.prompt }],
        });
        return parseJsonObject(textFromAnthropicResponse(data));
    }
    throw new Error(`Unsupported provider: ${request.provider}`);
}
function defaultModel(provider) {
    const configured = envValue(["AIPROD_LLM_MODEL"]);
    if (configured)
        return configured;
    if (provider === "gemini")
        return envValue(["GEMINI_MODEL"]) ?? "gemini-1.5-flash";
    if (provider === "anthropic")
        return envValue(["ANTHROPIC_MODEL"]) ?? "claude-3-5-haiku-latest";
    return envValue(["OPENAI_MODEL"]) ?? "gpt-4.1-mini";
}
async function runInformationDensityEvaluator(options) {
    try {
        const input = options.text ?? (0, fs_1.readText)(resolveInputFile(options.projectRoot, options.file ?? ""));
        const localLlm = readLocalLlmConfig(options.projectRoot);
        const provider = (options.provider ?? localLlm.provider ?? envValue(["AIPROD_LLM_PROVIDER"]) ?? "openai").toLowerCase();
        const model = options.model ?? localLlm.model ?? defaultModel(provider);
        const baseUrl = options.baseUrl ?? localLlm.baseUrl ?? envValue(["AIPROD_LLM_BASE_URL"]);
        const apiKey = localLlm.apiKey;
        const prompt = informationDensityPrompt(input);
        if (options.promptOnly) {
            console.log(JSON.stringify({
                ok: true,
                tool: "information_density_evaluator",
                provider,
                model,
                base_url: baseUrl ?? null,
                api_key_source: apiKey ? "local" : "environment",
                prompt,
            }, null, 2));
            return 0;
        }
        const evaluation = await callLlm({ provider, model, baseUrl, apiKey, prompt });
        console.log(JSON.stringify({
            ok: true,
            tool: "information_density_evaluator",
            provider,
            model,
            base_url: baseUrl ?? null,
            api_key_source: apiKey ? "local" : "environment",
            input: {
                file: options.file ?? null,
                text_length: input.length,
            },
            evaluation,
        }, null, 2));
        return 0;
    }
    catch (error) {
        console.log(JSON.stringify({
            ok: false,
            tool: "information_density_evaluator",
            error: error instanceof Error ? error.message : String(error),
        }, null, 2));
        return 1;
    }
}
exports.informationDensityEvaluatorTool = {
    name: "information_density_evaluator",
    run: async (args, context) => {
        const promptOnly = args.includes("--prompt-only");
        const filtered = args.filter((arg) => arg !== "--prompt-only");
        const file = (0, args_1.consumeOption)(filtered, "--file") ?? filtered[0];
        const text = (0, args_1.consumeOption)(filtered, "--text");
        const provider = (0, args_1.consumeOption)(filtered, "--provider");
        const model = (0, args_1.consumeOption)(filtered, "--model");
        const baseUrl = (0, args_1.consumeOption)(filtered, "--base-url");
        if (!file && !text)
            throw new Error("information_density_evaluator requires --file <path> or --text <text>");
        if (file === filtered[0])
            filtered.shift();
        if (filtered.length > 0)
            throw new Error(`Unknown information_density_evaluator arguments: ${filtered.join(" ")}`);
        return await runInformationDensityEvaluator({ file, text, provider, model, baseUrl, promptOnly, projectRoot: context.projectRoot });
    },
};
