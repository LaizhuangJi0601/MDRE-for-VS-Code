<p align="center"><img src="media/icon.png" alt="MDRE" width="104"></p>

<h1 align="center">MDRE for VS Code</h1>

<p align="center"><strong>One Markdown document. Two ways to edit.</strong><br>Synchronized Markdown source and rich-text editing inside VS Code.<br><sub>VS Code 1.95+ · English / 简体中文</sub></p>

<p align="center">
  <a href="https://github.com/LaizhuangJi0601/MDRE-for-VS-Code/blob/main/CHANGELOG.md"><img src="https://img.shields.io/badge/version-0.2.7-2878d5" alt="Version 0.2.7"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-5b8c70" alt="MIT license"></a>
  <a href="https://code.visualstudio.com/"><img src="https://img.shields.io/badge/VS_Code-1.95%2B-667085" alt="VS Code 1.95+"></a>
</p>

<p align="center"><a href="#features">Features</a> · <a href="#getting-started">Getting started</a> · <a href="#documentation">Documentation</a> · <a href="#development">Development</a> · <a href="#license">License</a></p>

<p align="center"><strong>English</strong> · <a href="README.zh-CN.md">简体中文</a></p>

## Features

- **Edit source and rich text together.** Keep both panes synchronized, or work in rich text alone, with formatting for headings, lists, links, and text from the toolbar and context menus.
- **Write equations, diagrams, and code.** Render math with KaTeX, edit equations visually with MathLive, use Mermaid diagrams across common diagram types, and highlight code with selectable themes.
- **Choose a reading layout.** Read or edit in continuous or paged A4 layouts with adjustable zoom, or adjust the reading width and choose among four text alignments outside A4.
- **Work with tables and images.** Resize columns, align or merge cells, split merged cells, and browse image references in document order.
- **Export and exchange content.** Export HTML, PDF, or a shareable ZIP, copy rich text, and paste HTML as Markdown.
- **Convert Word documents.** Import and export `.docx` files through a separately installed Pandoc.
- **Set up your workspace.** Open settings as a popup inside the editor and choose light or dark themes, English or Simplified Chinese, view presets, system fonts, and searchable offline help with chapter navigation.

## Screenshot

![MDRE for VS Code with synchronized Markdown source and rich-text views](media/screenshots/editor.png)

## Getting started

Install MDRE from the Marketplace, or install the VSIX package and run:

```powershell
code --install-extension .\mdre-vscode-0.2.7.vsix --force
```

Reload VS Code, open a `.md` or `.markdown` file, and choose **Reopen Editor With → MDRE Split Editor**; you can also run **MDRE: Open split editor** from the Command Palette. The editor shows rich text first, and the split-view button reveals the Markdown source.

Saving, autosave, undo and redo use VS Code's document model. MDRE is an optional Markdown editor that works alongside the built-in editor.

PDF export uses Microsoft Edge or Google Chrome; set `mdre.pdf.browserPath` if detection fails. Word import and export use a separately installed [Pandoc](https://pandoc.org/installing.html).

MDRE runs locally. Editor resources, equation fonts and offline help are bundled; remote images and external links need network access.

## Documentation

- [User guide](docs/help/en/usage.md)
- [Syntax reference](docs/help/en/syntax.md)
- [Notices and licenses](docs/help/en/notices.md)
- [Changelog](CHANGELOG.md)

Looking for the desktop edition? See [MDRE for Windows](https://github.com/LaizhuangJi0601/MDRE).

## Development

Use Node.js 24 LTS and pnpm 12.x, with VS Code for extension debugging.

```powershell
git clone https://github.com/LaizhuangJi0601/MDRE-for-VS-Code.git
cd MDRE-for-VS-Code
pnpm install --frozen-lockfile
pnpm build
pnpm package
```

`pnpm dev` starts an Extension Development Host. See [development notes](docs/development.md) for checks and tooling.

## Contributing

Bug reports, suggestions, and pull requests are welcome. Use [Issues](https://github.com/LaizhuangJi0601/MDRE-for-VS-Code/issues) with the version, reproduction steps, and a small Markdown example; include a screenshot for visual issues. Keep the English and Chinese documentation aligned.

## License

MDRE is released under the [MIT License](LICENSE). It builds on projects including [Tauri](https://tauri.app/), [CodeMirror](https://codemirror.net/), [ProseMirror](https://prosemirror.net/), [markdown-it](https://github.com/markdown-it/markdown-it), [KaTeX](https://katex.org/), [MathLive](https://mathlive.io/), [Mermaid](https://mermaid.js.org/), and [highlight.js](https://highlightjs.org/).

Third-party copyright and usage terms remain governed by their original licenses. See [notices and licenses](docs/help/en/notices.md).
