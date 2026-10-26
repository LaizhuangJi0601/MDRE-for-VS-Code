# Development

This repository contains the standalone VS Code extension. Use Node.js 24 LTS and pnpm 12.x.

```powershell
pnpm install --frozen-lockfile
pnpm build
pnpm test:core
pnpm test:ui
pnpm test:pdf
pnpm test:host
pnpm audit:source
pnpm package
```

`extension/` contains the VS Code host, `src/` the webview editor, and `tests/` the portable checks. `pnpm dev` starts a watch build and an Extension Development Host. Host changes require restarting the extension host; webview changes refresh automatically.

VS Code is detected from PATH and standard install locations. Set `MDRE_VSCODE_EXECUTABLE` to its full executable path if needed. PDF checks require Edge or Chrome. Word checks use a separately installed Pandoc. Tests use isolated profiles and temporary output directories.

`pnpm screenshot` creates an English editor preview from a public sample. Keep screenshots free of user files and machine paths. Keep README.md (English) and README.zh-CN.md aligned.
