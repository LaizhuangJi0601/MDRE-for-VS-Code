// 用途：watch 的插件宿主／界面验证。
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'src/ui/shell.ts');
const original = await readFile(source, 'utf8');
const child = spawn(process.execPath, [path.join(root, 'scripts/build.mjs'), '--watch'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
const waiters = [];
let ready = 0, output = '';
child.stdout.on('data', chunk => {
  output += chunk;
  process.stdout.write(chunk);
  if (chunk.toString().includes('MDRE_BUILD_READY')) {
    ready++;
    for (const waiter of waiters) if (ready >= waiter.count) waiter.resolve();
  }
});
child.stderr.on('data', chunk => process.stderr.write(chunk));
const untilReady = count => new Promise((resolve, reject) => {
  if (ready >= count) { resolve(); return; }
  const timer = setTimeout(() => reject(new Error('监听编译超时：' + output)), 60000);
  waiters.push({ count, resolve: () => { clearTimeout(timer); resolve(); } });
});
let restored = false;
try {
  await untilReady(1);
  const modified = original.replace('aria-label="编辑工具"', 'aria-label="编辑工具（监听验收）"');
  assert.notEqual(modified, original);
  await writeFile(source, modified);
  await untilReady(2);
  const manifest = JSON.parse(await readFile(path.join(root, 'dist/webview/.vite/manifest.json'), 'utf8'));
  const script = await readFile(path.join(root, 'dist/webview', manifest['index.html'].file), 'utf8');
  assert(script.includes('编辑工具（监听验收）'));
  await writeFile(source, original);
  restored = true;
  await untilReady(3);
  assert.equal(await readFile(source, 'utf8'), original);
  const passed = ['修改源码自动重编译，修改内容进入前端产物', '恢复源码后再次自动重编译，源码原样恢复'];
  await mkdir(path.join(root, '.tmp/watch'), { recursive: true });
  await writeFile(path.join(root, '.tmp/watch/results.json'), JSON.stringify({ passed }, null, 2));
  console.log(JSON.stringify({ passed }, null, 2));
} finally { if (!restored) await writeFile(source, original); child.kill(); }
