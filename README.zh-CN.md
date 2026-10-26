<p align="center"><img src="media/icon.png" alt="MDRE" width="104"></p>

<h1 align="center">MDRE for VS Code</h1>

<p align="center"><strong>同一份 Markdown，两种编辑方式。</strong><br>在 VS Code 中同步编辑 Markdown 源码与富文本。<br><sub>VS Code 1.95+ · English / 简体中文</sub></p>

<p align="center">
  <a href="https://github.com/LaizhuangJi0601/MDRE-for-VS-Code/blob/main/CHANGELOG.md"><img src="https://img.shields.io/badge/version-0.2.6-2878d5" alt="Version 0.2.6"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-5b8c70" alt="MIT license"></a>
  <a href="https://code.visualstudio.com/"><img src="https://img.shields.io/badge/VS_Code-1.95%2B-667085" alt="VS Code 1.95+"></a>
</p>

<p align="center"><a href="#功能">功能</a> · <a href="#下载安装">下载安装</a> · <a href="#开发">开发</a> · <a href="#参与贡献">参与贡献</a> · <a href="#许可">许可</a></p>

<p align="center"><a href="README.md">English</a> · <strong>简体中文</strong></p>

## 界面预览

![MDRE for VS Code 的 Markdown 源码与富文本编辑界面](media/screenshots/editor.png)

## 功能

- **源码与富文本同步编辑。** 两栏保持同步，也可仅显示富文本；标题、列表、链接和文字格式可通过工具栏或右键菜单编辑。
- **公式、图表与代码。** KaTeX 呈现数学公式，MathLive 提供可视化公式编辑；支持 Mermaid 图表、代码高亮与代码块主题。
- **按阅读方式排版。** A4 连续或分页视图支持 25%–250% 缩放；非 A4 页宽可在 60%–100% 间调整，正文支持四种对齐方式。
- **处理表格与图片。** 调整列宽、对齐、合并和拆分单元格；图片管理按引用顺序列出资源，并可定位到正文。
- **导出与互通。** 导出 HTML、PDF，或包含 Markdown 与本地图片的 ZIP；支持复制为富文本及 HTML 转 Markdown 粘贴。
- **Word 转换。** 调用另行安装的 Pandoc 导入、导出 `.docx`，支持常见结构与公式。
- **按偏好组织工作区。** 提供浅色／深色主题、简体中文／English、视图预设、分类设置、章节导航和可搜索的离线帮助。

文件、标签、保存及撤销／重做使用 VS Code 原生机制。MDRE 作为可选编辑器打开 Markdown，保留原生 Markdown 编辑器。

编辑与预览在本机运行；编辑器资源、公式字体与帮助文档随程序提供。网络图片与外部链接的可用性取决于网络。支持范围见[使用指南](docs/help/usage.md)与[语法参考](docs/help/syntax.md)。

## 下载安装

当前构建为 **0.2.6 · updata2**。[更新记录](CHANGELOG.md)汇总版本变化。

| 版本 | 下载 | 运行要求 |
| --- | --- | --- |
| VS Code 插件 | [下载 mdre-vscode-0.2.6.vsix](https://github.com/LaizhuangJi0601/MDRE-for-VS-Code/releases/download/v0.2.6/mdre-vscode-0.2.6.vsix) · [SHA-256](SHA256SUMS.txt) | VS Code 1.95+ |

下载 VSIX 后，在 VS Code 执行 **扩展：从 VSIX 安装…**，或运行：

```powershell
code --install-extension .\mdre-vscode-0.2.6.vsix --force
```

重新加载 VS Code，打开 `.md` 或 `.markdown` 文件，选择 **重新打开编辑器方式 → MDRE 双栏编辑器**，也可在命令面板运行 **MDRE: 打开双栏编辑器**。扩展默认仅显示富文本；工具栏的分栏按钮可显示源码。

PDF 导出需要本机 Edge 或 Chrome。检测失败时，在 VS Code 设置中填写 `mdre.pdf.browserPath`。

Word 导入与导出需要 [Pandoc](https://pandoc.org/installing.html)，配置方法见[使用指南](docs/help/usage.md)。

另一种使用方式：[Windows 桌面版](https://github.com/LaizhuangJi0601/MDRE)。

## 开发

需要 Node.js 24 LTS、pnpm 12.x，以及用于调试的 VS Code。

```powershell
git clone https://github.com/LaizhuangJi0601/MDRE-for-VS-Code.git
cd MDRE-for-VS-Code
pnpm install --frozen-lockfile
pnpm build
pnpm package
```

`pnpm build` 构建扩展宿主与 Webview，`pnpm package` 生成 VSIX。`pnpm dev` 可在 VS Code 扩展开发宿主中调试；开发检查见[开发文档](docs/development.md)。

## 参与贡献

欢迎通过 [Issues](https://github.com/LaizhuangJi0601/MDRE-for-VS-Code/issues) 报告问题或提出建议，也可提交 Pull Request。报告问题时，请附上版本、操作步骤和最小 Markdown 示例；界面问题可附截图。涉及文档的改动，请同步维护中英文说明。

## 许可

MDRE 采用 [MIT 许可证](LICENSE)。感谢 [Tauri](https://tauri.app/)、[CodeMirror](https://codemirror.net/)、[ProseMirror](https://prosemirror.net/)、[markdown-it](https://github.com/markdown-it/markdown-it)、[KaTeX](https://katex.org/)、[MathLive](https://mathlive.io/)、[Mermaid](https://mermaid.js.org/) 与 [highlight.js](https://highlightjs.org/) 等开源项目。

第三方组件的版权与使用条件以原始许可证为准，见[声明与许可](docs/help/third-party-notices.md)。
