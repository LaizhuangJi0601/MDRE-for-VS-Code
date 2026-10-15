# 开发与测试

本仓库是独立的 VS Code 扩展项目，构建过程不依赖桌面版源码、Rust 或 Tauri。

## 目录结构

| 目录 | 内容 |
| --- | --- |
| `extension/` | VS Code 文档、命令、设置、资源访问与 PDF 导出接口 |
| `src/` | Markdown 模型、双向编辑逻辑及 Webview 界面 |
| `scripts/` | 构建、开发启动、许可证资料生成与源码清单检查脚本 |
| `docs/help/` | 应用内离线帮助的源文档，构建时导入界面资源 |
| `docs/licenses/` | 第三方依赖清单与许可证原文，构建时生成并导入帮助资源 |
| `media/` | 扩展图标与示例截图 |
| `tests/` | 自动化测试代码及测试示例 |
| `.vscode/` | F5 调试配置与构建任务 |

## 开发环境

使用 Node.js 24 和 pnpm 12.11.2。安装依赖后，运行 `pnpm dev` 自动查找 VS Code 并启动扩展开发宿主；按 F5 则使用当前 VS Code 的调试配置。

如果 VS Code 未加入 PATH，或安装在非标准位置，可在当前终端中将 `MDRE_VSCODE_EXECUTABLE` 设置为可执行文件的完整路径。Windows 对应 `Code.exe`，macOS 对应应用包中的 Electron 可执行文件，Linux 对应安装目录中的 `code` 可执行文件。

界面源码、帮助文档或资源发生变化时，开发监听进程会重新构建并刷新编辑界面；修改 `extension/` 中的宿主代码后，需要重新启动扩展开发宿主。启动脚本通过参数数组传递路径，支持项目目录名包含空格。

## 测试

| 命令 | 验证范围与环境要求 |
| --- | --- |
| `pnpm test:core` | 核心 Markdown 解析、模型与编辑逻辑。 |
| `pnpm test:ui` | 在隔离的浏览器会话中验证编辑交互；本机需安装 Microsoft Edge。 |
| `pnpm test:host` | 使用隔离配置启动本机 VS Code，验证扩展激活、TextDocument、保存、撤销及 PDF 导出接口；PDF 验证需要 Edge 或 Chrome。 |
| `pnpm test:pdf`、`pnpm test:pdf-style` | PDF 导出中的公式、任务列表与行内代码等内容。 |
| `pnpm test:watch` | 构建监听与开发界面的刷新行为。 |

测试产物保存在 `.tmp/` 和 `output/` 中，这些目录已由 Git 与 VSIX 的排除规则过滤。测试示例位于仓库内。可选的 Python PDF 检查脚本需要另行安装 PyMuPDF。

## 构建与打包

`pnpm build` 先执行 TypeScript 类型检查，随后生成第三方依赖的许可证资料并构建扩展。主要产物为 `out/extension.cjs`、`out/pdf-engine/` 和 `dist/webview/`。

PDF 导出通过安装包内的 Playwright Core 调用系统 Edge 或 Chrome；扩展不自动下载 Chromium。

`pnpm audit:source` 检查公开源码清单、必要文件、版本信息与目录边界，并生成本地 `SOURCE_MANIFEST.json`。`pnpm package` 构建并生成 VSIX 安装包，不执行市场发布。

许可证资料的生成依据为当前安装的依赖。更新依赖后，应重新生成并检查清单及原文。开发流程见 [项目说明](../README.md)，发布流程见 [发布指南](../PUBLISHING.md)。
