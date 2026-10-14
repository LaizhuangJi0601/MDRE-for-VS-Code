import { spawn } from 'node:child_process';
import path from 'node:path';
import { vscodeExecutable } from './vscode-path.mjs';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const watcher = spawn(process.execPath, [path.join(root, 'scripts/build.mjs'), '--watch'], { cwd: root, stdio: ['inherit', 'pipe', 'inherit'] });
let opened = false;
watcher.stdout.on('data', chunk => {
  process.stdout.write(chunk);
  if (!opened && chunk.toString().includes('MDRE_BUILD_READY')) {
    opened = true;
    const args = ['--new-window', `--extensionDevelopmentPath=${root}`, root];
    // 直接启动可执行文件并传递参数数组，保留含空格的项目路径。
    const environment = { ...process.env };
    delete environment.ELECTRON_RUN_AS_NODE;
    const editor = spawn(vscodeExecutable(), args, { cwd: root, stdio: 'inherit', windowsHide: true, env: environment });
    editor.on('error', reason => { console.error(reason); watcher.kill(); });
  }
});
process.on('SIGINT', () => watcher.kill());
watcher.on('exit', code => { process.exitCode = code ?? 0; });
