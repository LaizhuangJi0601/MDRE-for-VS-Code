import { existsSync } from 'node:fs';
import path from 'node:path';

// 避免写死本机路径；Windows 直接启动 Code.exe，含空格的参数由 spawn 处理。
export function vscodeExecutable() {
  if (process.env.MDRE_VSCODE_EXECUTABLE) {
    const executable = path.resolve(process.env.MDRE_VSCODE_EXECUTABLE);
    if (!existsSync(executable)) throw new Error('MDRE_VSCODE_EXECUTABLE 指向的文件不存在。');
    return executable;
  }
  const candidates = [];
  for (const folder of (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)) {
    const directory = folder.replace(/^"|"$/g, '');
    if (process.platform === 'win32') {
      candidates.push(path.join(directory, 'Code.exe'));
      if (existsSync(path.join(directory, 'code.cmd'))) candidates.push(path.resolve(directory, '..', 'Code.exe'));
    } else candidates.push(path.join(directory, 'code'));
  }
  if (process.platform === 'win32') {
    if (process.env.LOCALAPPDATA) candidates.push(path.join(process.env.LOCALAPPDATA, 'Programs', 'Microsoft VS Code', 'Code.exe'));
    if (process.env.ProgramFiles) candidates.push(path.join(process.env.ProgramFiles, 'Microsoft VS Code', 'Code.exe'));
  } else if (process.platform === 'darwin') candidates.push('/Applications/Visual Studio Code.app/Contents/MacOS/Electron');
  const executable = candidates.find(candidate => existsSync(candidate));
  if (!executable) throw new Error('未找到 VS Code。请安装并加入 PATH，或设置当前终端的 MDRE_VSCODE_EXECUTABLE。');
  return executable;
}
