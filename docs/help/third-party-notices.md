# MDRE for VS Code 第三方组件声明

MDRE for VS Code **0.2.2** 采用 MIT 许可证。第三方组件的版权与授权条件分别由其原始许可证规定。

本项目使用 CodeMirror、ProseMirror、markdown-it、KaTeX、MathLive、Mermaid、highlight.js、Lezer、entities、Playwright Core 和 VS Code Extension API，并使用 TypeScript、Vite、esbuild、tsx 与 vsce 等开发工具。感谢相关项目的作者、维护者及贡献者。

该仓库提供 VS Code 扩展源码，不包含桌面应用的原生后端。PDF 导出调用系统 Edge 或 Chrome；公式字体及第三方授权资料随扩展提供。文档图片保存在相应文档的资源目录中，可在导出时嵌入输出文件。

依赖记录见 [第三方依赖清单](../licenses/dependencies.md)，授权与版权文本见 [许可证原文](../licenses/license-texts.txt)。清单记录生成时已安装的依赖，不代表所有组件均属于扩展的运行依赖。许可证表达式中的 `OR` 表示可选择其中一种许可证，`AND` 表示需同时遵守所列许可证；具体条款以对应组件的原文为准。
