# references

`references/` 存放外部来源资料、补充参考资料和外部对接配置。

本目录用于管理：

- 外部参考资料；
- 当前产品工作区外部对接配置；
- 不属于原始诉求、正式需求、当前产品事实、可复用产品资产或用户文档的补充资料。

本目录不存放：

- 当前产品事实；
- Product Discovery 或 Product Change 主文档；
- Agent 执行记录；
- 本地密钥。
- 产品私有、需要长期复用和维护的 API Contract、fixture、设计规范、数据集或工具；此类内容放入 `resources/`。

```text
references/
  integrations/
    integrations.json
    secrets.local.example.json
    secrets.local.json
```

| 路径 | 说明 |
| --- | --- |
| `integrations/` | 当前产品工作区外部对接配置，包括外部系统、CLI、MCP 和外部资源实例。 |
| `integrations/integrations.json` | 外部资源实例登记文件。 |
| `integrations/secrets.local.example.json` | 本机配置示例，可提交。 |
| `integrations/secrets.local.json` | 本机配置文件，包含非敏感本机值和密钥，不得提交到 Git。 |

## integrations

`references/integrations/` 存放当前产品工作区使用的外部对接配置。

外部系统、CLI、MCP、数据库、接口平台、在线文档、资源实例等对接信息，应优先登记到本目录。涉及密钥、令牌、账号或本地机器路径的信息，必须放入本地忽略文件或受控密钥系统，不得提交到 Git。

创建或更新外部对接配置时，应按需阅读：

```text
_aiprod/references/integrations/configuration.md
```

API Contract 属于产品私有、可复用的维护资产，统一放在 `resources/api_contracts/`，不放在本目录。其接口地址、认证引用、CLI/MCP 连接和其他外部实例配置仍登记在 `integrations/`。
