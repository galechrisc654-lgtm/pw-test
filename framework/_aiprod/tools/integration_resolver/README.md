# Integration Resolver

`integration_resolver` 用于解析 AIProd 外部对接配置。

它只理解统一的 integration 外壳：

```json
{
  "integrations": {
    "integration_id": {
      "adapter": "adapter_name",
      "enabled": true,
      "params": {}
    }
  }
}
```

`params` 内部字段由对应 Adapter 的 `Parameter Schema` 定义。Resolver 不解释具体 Adapter 参数语义，只负责读取、变量解析、脱敏和输出。

它读取：

```text
references/integrations/integrations.json
references/integrations/secrets.local.json
```

并解析：

- `${env:NAME}`：从环境变量读取。
- `${local:NAME}`：从 `secrets.local.json` 的 `locals` 读取本机非敏感配置。
- `${secret:NAME}`：从 `secrets.local.json` 的 `secrets` 读取敏感值。
- `${project_root}`：当前产品工作区根目录。

## Usage

Agent 如需在产品工作区根目录通过命令行调用，可使用 `_aiprod/runtime` 入口：

```powershell
node .\_aiprod\runtime\aiprod-launcher.cjs run integration_resolver defaults --project-root .
node .\_aiprod\runtime\aiprod-launcher.cjs run integration_resolver {integration_id} --project-root .
```

如果当前 shell 已安装全局 `aiprod` 命令，也可以使用等价的 `aiprod run ...`。

默认输出会脱敏。执行外部调用需要真实敏感值时，使用：

```powershell
node .\_aiprod\runtime\aiprod-launcher.cjs run integration_resolver {integration_id} --raw --project-root .
```

`--raw` 输出包含真实本机配置和私密值，只能用于内部执行，不得直接展示给用户。

## Local Values

`secrets.local.json` 使用两个顶层对象区分本机非敏感配置和敏感值：

```json
{
  "version": 1,
  "locals": {
    "TOOL_PATH": "C:/path/to/tool.cmd",
    "TOOL_PROFILE": "default"
  },
  "secrets": {
    "ACCESS_TOKEN": "replace-with-local-access-token"
  }
}
```

路径、profile 名称、外部源码目录等属于 `locals`。它们不是密钥，但属于个人本机环境配置，不应写入可提交文件。

密码、token、app secret、完整连接串等属于 `secrets`，可直接配置在这个已被 Git 忽略的本机文件中。CI 或临时会话也可以填写 `${env:NAME}`。默认解析会脱敏，只有 `--raw` 会返回真实值。

## Local Overrides

如确需覆盖某个 integration 的本机参数，可在 `secrets.local.json` 中使用同名 `integrations` 覆盖：

```json
{
  "version": 1,
  "locals": {
    "LARK_CLI_PATH": "C:/path/to/lark-cli.cmd",
    "LARK_CLI_PROFILE": "default"
  },
  "integrations": {
    "lark_cli": {
      "params": {
        "executable_path": "${local:LARK_CLI_PATH}",
        "profile": "${local:LARK_CLI_PROFILE}"
      }
    }
  }
}
```

## Responsibility

Resolver 负责：

- 读取项目级通用配置。
- 读取本机配置。
- 按 integration id 读取 `adapter + params`。
- 合并本机覆盖配置。
- 解析变量。
- 标记敏感字段。
- 输出 JSON。

Resolver 不负责：

- 执行 SQL。
- 调用 `CLI`。
- 启动 `MCP Server`。
- 判断业务范围。
- 写入产品事实。

`Skill` / `Routine` 应调用 resolver 获取 resolved parameters，再交给 `Adapter` 执行外部调用。
