import { build as bundle } from 'esbuild';
import { generateLicenses } from './generate-licenses.mjs';
import { build as webview } from 'vite';
import { mkdir, writeFile, cp } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { watch } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require=createRequire(import.meta.url);
process.chdir(root);
const listening = process.argv.includes('--watch');
let running = false, again = false, hostChanged = true, webChanged = true;
async function build() {
  if (running) { again = true; return; }
  running = true;
  const host = hostChanged, web = webChanged;
  hostChanged = webChanged = false;
  console.log('MDRE_BUILD_START');
  try {
    if (host) {
      await cp(path.dirname(require.resolve('playwright-core/package.json')),'out/pdf-engine',{recursive:true});
      await bundle({ entryPoints: ['extension/extension.ts'], outfile: 'out/extension.cjs', bundle: true, platform: 'node', format: 'cjs', external: ['vscode','./pdf-engine'], sourcemap: true });
    }
    if (web) {
      await webview({ logLevel: 'warn' });
      // 只在完整产物写入后通知界面，避免读取到半次编译的资源。
      await writeFile('dist/webview/.ready', String(Date.now()));
    }
    console.log(`MDRE_BUILD_READY${host ? ' · 宿主代码更新：重新启动扩展宿主' : ' · 编辑界面已自动刷新'}`);
  } catch (reason) { console.error(reason); if (!listening) process.exitCode = 1; }
  finally { running = false; if (again) { again = false; void build(); } }
}
await generateLicenses();
await mkdir('out', { recursive: true });
if (listening) {
  let timer;
  for (const folder of ['src', 'extension', 'docs', 'public']) watch(folder, { recursive: true }, () => {
    if (folder === 'extension') hostChanged = true; else webChanged = true;
    clearTimeout(timer); timer = setTimeout(() => void build(), 120);
  });
  watch('vite.config.ts', () => { webChanged = true; void build(); });
}
await build();
