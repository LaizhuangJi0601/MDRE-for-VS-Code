# Notices and licenses

MDRE is licensed under MIT. Third-party copyright and usage terms are governed by each component's original license. This page identifies the main components, runtime tools and offline licensing materials.

## Main components

| Component | Purpose | Project |
| --- | --- | --- |
| VS Code API | Editor hosting, documents, windows and commands | [VS Code](https://github.com/microsoft/vscode) |
| CodeMirror 6 / Lezer | Source editing, parsing and highlighting | [CodeMirror](https://codemirror.net/) · [Lezer](https://lezer.codemirror.net/) |
| ProseMirror | Rich-text editing and document transactions | [ProseMirror](https://prosemirror.net/) |
| markdown-it / entities | Markdown and HTML entity processing | [markdown-it](https://github.com/markdown-it/markdown-it) · [entities](https://github.com/fb55/entities) |
| KaTeX / MathLive | Equation rendering, fonts and visual editing | [KaTeX](https://github.com/KaTeX/KaTeX) · [MathLive](https://github.com/arnog/mathlive) |
| Mermaid / highlight.js | Diagrams and code highlighting | [Mermaid](https://github.com/mermaid-js/mermaid) · [highlight.js](https://github.com/highlightjs/highlight.js) |
| Node.js / Playwright | System integration and PDF printing | [Node.js](https://github.com/nodejs/node) · [Playwright](https://github.com/microsoft/playwright) |

## Runtime and external tools

The editor runs inside VS Code webviews. PDF output uses a local Edge/Chrome browser. Word conversion invokes a user-installed [Pandoc](https://pandoc.org/), distributed separately from MDRE.

## Development tools

The project uses [Rust](https://github.com/rust-lang/rust), [TypeScript](https://github.com/microsoft/TypeScript), [Vite](https://github.com/vitejs/vite), [Playwright](https://github.com/microsoft/playwright), [tsx](https://github.com/privatenumber/tsx) and [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped). We acknowledge their authors, maintainers and contributors.

## Licensing materials

- [Dependency inventory](../../licenses/dependencies.en.md): build-time dependencies and license information.
- [Original license and copyright texts](../../licenses/license-texts.txt): complete offline texts, preserved in their original languages.

Development and test dependencies in the inventory are not all product runtime dependencies. In license expressions, OR permits choosing a license and AND requires compliance with both. The original terms take precedence.
