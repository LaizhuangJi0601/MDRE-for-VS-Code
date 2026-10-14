import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { vscodeExecutable } from '../scripts/vscode-path.mjs';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await mkdir(path.join(root, '.tmp/host'), { recursive: true });
await build({ entryPoints: [path.join(root, 'tests/host-suite.ts')], outfile: path.join(root, '.tmp/host/suite.cjs'), bundle: true, platform: 'node', format: 'cjs', external: ['vscode'],plugins:[{name:'pdf-engine',setup(build){build.onResolve({filter:/^\.\/pdf-engine$/},()=>({path:path.join(root,'out/pdf-engine'),external:true}));}}] });
const executable = vscodeExecutable();
const environment = { ...process.env };
delete environment.ELECTRON_RUN_AS_NODE;
// 独立测试配置，避免改动用户的工作区、设置和已安装插件。
const child = spawn(executable, [
  '--no-sandbox', '--skip-welcome', '--skip-release-notes', '--disable-workspace-trust',
  `--user-data-dir=${root}/.tmp/host/profile`, `--extensions-dir=${root}/.tmp/host/extensions`,
  `--extensionDevelopmentPath=${root}`, `--extensionTestsPath=${root}/.tmp/host/suite.cjs`,
], { stdio: 'inherit', windowsHide: true, env: environment });
child.on('error', reason => { console.error(reason); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
