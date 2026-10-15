# 文档目录

- [使用说明](help/usage.md)：扩展的主要功能与操作方法。
- [语法说明](help/syntax.md)：Markdown 语法及 MDRE 扩展写法。
- [第三方组件声明](help/third-party-notices.md)：项目许可证、依赖清单及第三方授权资料。
- [开发与测试](development.md)：开发环境、目录结构、构建与验证方法。

`docs/help/` 是应用内离线帮助的源文档；`docs/licenses/` 存放第三方依赖清单与许可证原文。构建时，`scripts/generate-licenses.mjs` 根据已安装的依赖生成授权资料，原文读取自相应组件的授权文件。该过程不依赖 Cargo 或桌面版工程。
