# 声明与许可

MDRE for VS Code 采用 MIT 许可证。第三方组件的版权与使用条件以各自原始许可证为准；本页说明扩展使用的主要组件与授权资料。

## 主要组件

| 组件 | 用途 | 项目地址 |
| --- | --- | --- |
| VS Code Extension API | 文档、工作区与编辑器集成 | [VS Code](https://github.com/microsoft/vscode) |
| CodeMirror 6／Lezer | 源码编辑、语法分析与高亮 | [CodeMirror](https://codemirror.net/) · [Lezer](https://lezer.codemirror.net/) |
| ProseMirror | 富文本编辑与文档事务 | [ProseMirror](https://prosemirror.net/) |
| markdown-it／entities | Markdown 与 HTML 实体处理 | [markdown-it](https://github.com/markdown-it/markdown-it) · [entities](https://github.com/fb55/entities) |
| KaTeX／MathLive | 公式排版、字体与可视化编辑 | [KaTeX](https://github.com/KaTeX/KaTeX) · [MathLive](https://github.com/arnog/mathlive) |
| Mermaid／highlight.js | 图表与代码高亮 | [Mermaid](https://github.com/mermaid-js/mermaid) · [highlight.js](https://github.com/highlightjs/highlight.js) |
| Playwright Core | 调用系统浏览器导出 PDF | [Playwright](https://github.com/microsoft/playwright) |

## 运行环境与外部工具

扩展在 VS Code 的 Webview 中运行，不包含桌面应用的原生后端。PDF 导出调用系统 Edge 或 Chrome；公式字体与授权资料随包提供。Word 转换调用用户安装的 [Pandoc](https://pandoc.org/)，Pandoc 不随扩展分发。

## 开发工具

项目使用 [TypeScript](https://github.com/microsoft/TypeScript)、[Vite](https://github.com/vitejs/vite)、[esbuild](https://github.com/evanw/esbuild)、[tsx](https://github.com/privatenumber/tsx) 和 [vsce](https://github.com/microsoft/vscode-vsce)。感谢各项目及其依赖的作者、维护者与贡献者。

## 授权资料

- [第三方依赖清单](../licenses/dependencies.md)：记录构建时的依赖及许可证信息。
- [许可证原文](../licenses/license-texts.txt)：随扩展离线提供的版权与授权文本。

清单中的开发、测试依赖不等同于扩展运行依赖。许可证表达式中的 `OR` 表示可选择一种许可证，`AND` 表示需同时遵守；具体条款以对应原文为准。
