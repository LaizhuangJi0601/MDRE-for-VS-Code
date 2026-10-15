# 发布到 Visual Studio Marketplace

本指南说明 MDRE for VS Code 的打包与发布流程。当前项目版本为 **0.2.1**。生成 VSIX 安装包与发布到 Visual Studio Marketplace 是两项独立操作。

## 发布配置

| 项目 | 当前配置 | 发布前的处理 |
| --- | --- | --- |
| 发布者 ID | `mdre-local` | 确认已注册并有权使用该发布者；使 `package.json` 的 `publisher` 字段与实际 ID 一致。 |
| 源码仓库地址 | [MDRE-for-VS-Code](https://github.com/LaizhuangJi0601/MDRE-for-VS-Code) | 已配置 `repository`、`bugs` 和 `homepage`。发布前确认链接可访问；公开源码不是市场发布的必要条件。 |
| 扩展名称 | `mdre-vscode` | 首次发布前确认名称可用；发布者 ID 与扩展名称共同构成扩展安装标识。 |
| 显示名称 | MDRE for VS Code | 确认名称符合平台要求，并与说明文档一致。 |
| 版本号 | `0.2.1` | 首次发布可使用当前版本；后续发布应递增版本号，不可覆盖已发布的同版本包。 |
| 图标 | `media/icon.png` | 当前图标为 256 × 256 像素的 PNG，满足平台至少 128 × 128 像素的要求。 |

## 验证与打包

在项目根目录执行：

```powershell
pnpm install --frozen-lockfile
pnpm audit:source
pnpm build
pnpm test:core
pnpm test:ui
pnpm test:host
pnpm package
pnpm exec vsce ls --no-dependencies
```

`pnpm package` 构建项目并生成 `mdre-vscode-0.2.1.vsix`，不执行账号登录或市场发布。发布前，应通过“扩展：从 VSIX 安装”安装该文件并验证实际使用效果。

源码与测试代码由 Git 管理；VSIX 文件内容由 `.vscodeignore` 筛选。测试输出、私人文档、缓存、访问凭据及 `node_modules/` 不应提交到公开仓库。

`pnpm screenshot` 使用内置示例生成 `media/screenshots/` 中的截图。将截图加入 README 或 CHANGELOG 时，应配置可访问的 HTTPS 图片地址，或填写正确的仓库地址，使打包工具能够解析相对链接。

## 网页上传

1. 使用 Microsoft 账号登录 [发布者管理页面](https://marketplace.visualstudio.com/manage)。
2. 创建或选择具有管理权限的 Publisher，确认发布者 ID。
3. 如发布者 ID 有变化，修改 `package.json` 中的 `publisher` 字段并重新打包。
4. 选择 **New extension → Visual Studio Code**，上传经验证的 VSIX 文件。
5. 根据平台提示完成发布。扩展通过检查并完成索引后，用户即可在 VS Code 扩展市场中搜索、安装。

## 命令行发布

命令行发布需要发布者权限及有效的认证配置。Microsoft 当前建议采用基于 Microsoft Entra ID 的认证；完成官方指南中的身份与权限配置后，可执行：

```powershell
pnpm exec vsce publish --azure-credential --packagePath ".\mdre-vscode-0.2.1.vsix"
```

该命令执行正式发布，应在版本号、发布者信息和安装包均已确认后运行。

截至 **2026-10-14**，官方文档仍提供 Personal Access Token（PAT）认证方式，并说明 Azure DevOps 的全局 PAT 将于 **2026-12-01** 停用。长期发布流程应按照官方指引配置 Microsoft Entra ID 认证。

若在仍受支持的环境中使用 PAT，应选择 **All accessible organizations**，权限为 **Marketplace → Manage**。在交互式登录提示中输入令牌，不将令牌写入项目文件：

```powershell
# 将下列值替换为实际发布者 ID。
$publisherId = "your-publisher-id"
pnpm exec vsce login $publisherId
pnpm exec vsce publish --packagePath ".\mdre-vscode-0.2.1.vsix"
```

后续更新应先修改版本号，例如 `0.2.1`，再完成验证、打包和发布。

认证方式与平台要求以 [VS Code 官方发布指南](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) 的现行说明为准。
