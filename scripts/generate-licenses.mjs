import { readFile, writeFile, readdir, realpath } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
async function installed(name, from) {
  for (let folder = from; ; folder = path.dirname(folder)) {
    const candidate = path.join(folder, 'node_modules', name, 'package.json');
    if (existsSync(candidate)) {
      const directory = path.dirname(await realpath(candidate));
      return { directory, metadata: JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8')) };
    }
    if (folder === path.dirname(folder)) break;
  }
  return null;
}
async function writeChanged(name, content) {
  const file = path.join(root, name);
  if (await readFile(file, 'utf8').catch(() => null) !== content) await writeFile(file, content);
}
async function licenseFiles(directory, current = directory) {
  const result = [];
  for (const entry of await readdir(current, { withFileTypes: true })) {
    if (['node_modules', '.git', '.cache'].includes(entry.name)) continue;
    const file = path.join(current, entry.name);
    if (entry.isDirectory()) result.push(...await licenseFiles(directory, file));
    else if (entry.isFile() && /^(?:licen[cs]e|notice|copying|thirdpartynotices)(?:[._-]|$)/i.test(entry.name)) result.push(file);
  }
  return result;
}
export async function generateLicenses() {
  const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const packages = new Map(), missing = [];
  async function collect(name, from, role, descend = true, optional = false) {
    const resolved = await installed(name, from);
    if (!resolved) { if (!optional) missing.push(name); return; }
    const { metadata, directory } = resolved, id = `${metadata.name}@${metadata.version}`;
    if (packages.has(id)) return;
    packages.set(id, { ...resolved, role });
    if (descend) {
      for (const dependency of Object.keys(metadata.dependencies ?? {})) await collect(dependency, directory, '运行间接依赖', true, dependency in (metadata.optionalDependencies ?? {}));
      for (const dependency of Object.keys(metadata.optionalDependencies ?? {})) await collect(dependency, directory, '已安装的可选运行依赖', true, true);
    }
  }
  for (const name of Object.keys(manifest.dependencies ?? {})) await collect(name, root, '运行直接依赖');
  for (const name of Object.keys(manifest.devDependencies ?? {})) await collect(name, root, '开发直接依赖', false);
  if (missing.length) throw new Error(`缺少依赖，请先运行 pnpm install：${[...new Set(missing)].join(', ')}`);
  const rows = [...packages.values()].sort((a, b) => a.metadata.name.localeCompare(b.metadata.name) || a.metadata.version.localeCompare(b.metadata.version));
  const table = ['# MDRE for VS Code 第三方依赖', '', '[返回声明](../help/MDRE声明.md) · [许可证原文](许可证文本.txt)', '', '本清单记录生成时已安装的直接运行依赖、间接运行依赖及直接开发工具。未安装的平台可选依赖不列入清单。具体版权与授权条款以相应组件的上游原文为准。', '', '| 组件 | 版本 | 许可证 | 用途 |', '| --- | --- | --- | --- |'];
  const texts = ['MDRE for VS Code — Third-party license and copyright texts', 'Generated from installed plugin packages. Upstream texts are preserved below.', ''];
  for (const { metadata, directory, role } of rows) {
    const license = typeof metadata.license === 'object' ? metadata.license?.type : metadata.license;
    table.push(`| ${metadata.name} | ${metadata.version} | ${license ?? '见上游授权文件'} | ${role} |`);
    texts.push(`================ ${metadata.name}@${metadata.version} ================`, `Declared license: ${license ?? 'see upstream files'}`);
    for (const file of (await licenseFiles(directory)).sort()) {
      texts.push(`----- ${path.relative(directory, file).replaceAll('\\', '/')} -----`, await readFile(file, 'utf8'));
    }
    texts.push('');
  }
  await writeChanged('docs/licenses/依赖清单.md', table.join('\n') + '\n');
  await writeChanged('docs/licenses/许可证文本.txt', texts.join('\n') + '\n');
  return rows.length;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(`已生成 ${await generateLicenses()} 个插件依赖的授权资料。`);
