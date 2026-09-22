# openapi_document_builder

把服务端原始 OpenAPI、可选的代码补充契约与受控 JSON Patch 合成为可导入接口工具的标准 OpenAPI，并从维护版契约生成接口或分发变体目录及指纹。工具会检查合并冲突、OpenAPI 结构和本地 `$ref`。

生成完整维护版文档：

```powershell
node .\_aiprod\runtime\aiprod-launcher.cjs run openapi_document_builder --source resources/api_contracts/{service_id}/openapi.raw.json --source-metadata resources/api_contracts/{service_id}/source.json --supplement resources/api_contracts/{service_id}/openapi.supplement.json --overlay resources/api_contracts/{service_id}/overlays.json --catalog resources/api_contracts/{service_id}/operations.json --output resources/api_contracts/{service_id}/openapi.resolved.json --metadata resources/api_contracts/{service_id}/resolved.metadata.json --project-root .
```

没有补充文件时省略 `--supplement`。首次构建或补充变化后先不传 `--registry`，生成目录并同步登记表；状态更新完成后再传 `--registry` 构建最终文档。普通接口的验证扩展为状态字符串；统一分发 operation 的扩展按 variant ID 保存状态。

`--catalog` 与 `--source-metadata` 配合生成维护版 `operations.json`。补充 operation 与原始文档重复、组件定义冲突、变体声明无效或存在失效 `$ref` 时构建失败。命令结果返回原始、补充、维护版和输出哈希及接口数量，Agent 据此确认成功，不读取输出文档全文。支持 `--dry-run`。
