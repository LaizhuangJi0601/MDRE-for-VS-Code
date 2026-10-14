import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const excluded = new Set(['.git', '.cache', '.tmp', '.playwright-cli', 'node_modules', 'dist', 'out', 'output']);
async function publicFiles(directory = root) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (excluded.has(entry.name) || /\.(?:vsix|log)$/.test(entry.name) || ['SOURCE_MANIFEST.json', 'BUILDINFO.json'].includes(entry.name)) continue;
    assert.ok(!entry.isSymbolicLink(), `公开目录不能依赖符号链接：${entry.name}`);
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await publicFiles(file)); else if (entry.isFile()) files.push(file);
  }
  return files.sort();
}
const files = await publicFiles(), relative = file => path.relative(root, file).replaceAll('\\', '/');
for (const file of ['package.json', 'pnpm-lock.yaml', 'LICENSE', 'README.md', 'CHANGELOG.md', 'SUPPORT.md', 'PUBLISHING.md', 'media/icon.png', '.vscodeignore']) assert.ok(files.some(candidate => relative(candidate) === file), `缺少 ${file}`);
const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
assert.match(manifest.version, /^\d+\.\d+\.\d+$/); assert.equal(manifest.icon, 'media/icon.png');
assert.ok(manifest.publisher); assert.ok(manifest.keywords?.length); assert.equal(manifest.license, 'MIT');
const icon = await readFile(path.join(root, manifest.icon));
assert.equal(icon.subarray(1, 4).toString(), 'PNG'); assert.ok(icon.readUInt32BE(16) >= 128 && icon.readUInt32BE(20) >= 128);
const records = [];
for (const file of files) {
  const name = relative(file), data = await readFile(file);
  assert.ok(!/(?:^|\/)(?:src-tauri|测试文件|appdata|webview-profile)(?:\/|$)|\.(?:exe|pdf|docx|vsdx)$/i.test(name), `不应进入插件公开源码：${name}`);
  if (/\.(?:ts|mjs|css|md|json|yaml|yml|txt)$/.test(name)) {
    const text = data.toString('utf8');
    assert.ok(!/D:[/\\]Project[/\\]MDRE|D:[/\\]Microsoft VS Code/i.test(text), `残留本机开发路径：${name}`);
    assert.ok(!/gh[pousr]_[A-Za-z0-9]{24,}/.test(text), `不应含有访问令牌：${name}`);
    if (/\.(?:ts|mjs)$/.test(name)) for (const match of text.matchAll(/(?:from\s*|import\s*\(|require\s*\()(['"])(\.[^'"]+)\1/g)) {
      const target = path.resolve(path.dirname(file), match[2].split('?')[0]);
      assert.ok(target.startsWith(root + path.sep), `源码导入越过项目目录：${name} → ${match[2]}`);
    }
  }
  records.push({ path: name, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
}
await writeFile(path.join(root, 'SOURCE_MANIFEST.json'), JSON.stringify({ version: manifest.version, publisher: manifest.publisher, files: records }, null, 2) + '\n');
console.log(JSON.stringify({ version: manifest.version, files: records.length, icon: `${icon.readUInt32BE(16)}×${icon.readUInt32BE(20)}`, scope: 'VS Code only', publisher: manifest.publisher }, null, 2));
