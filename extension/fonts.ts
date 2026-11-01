// v0.2.7 需求 5.3：插件宿主侧读取本机已安装字体。
// 用 `reg export` 导出 UTF-16 注册表文件再解析，避免 `reg query` 控制台代码页导致的乱码。
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const FONT_KEYS = [
  'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts',
  'HKCU\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts',
];
// 字体注册表值名的样式后缀（“Arial Bold Italic (TrueType)” → “Arial”）。
const STYLE_SUFFIXES = ['Bold Italic', 'Bold Oblique', 'Bold', 'Italic', 'Oblique', 'Regular'];

// 一次运行内只枚举一次；设置页多次打开不再启动子进程。
let cache: string[] | undefined;
let loading: Promise<string[]> | undefined;

/** 本机字体族名：去重、忽略样式变体并按名称排序；非 Windows 或无结果时返回空数组。 */
export function listSystemFonts(): Promise<string[]> {
  if (process.platform !== 'win32') return Promise.resolve([]);
  if (cache) return Promise.resolve(cache);
  loading ??= enumerate()
    .then(fonts => { cache = fonts; loading = undefined; return fonts; })
    .catch(() => { loading = undefined; return []; });
  return loading;
}

async function enumerate(): Promise<string[]> {
  const directory = mkdtempSync(path.join(tmpdir(), 'mdre-fonts-'));
  try {
    const raw: string[] = [];
    for (const [index, key] of FONT_KEYS.entries()) {
      const file = path.join(directory, `fonts-${index}.reg`);
      try { await exportKey(key, file); } catch { continue; }
      try { raw.push(...parseFontExport(readFileSync(file, 'utf16le'))); } catch { /* 单个键读取失败不影响其它来源 */ }
    }
    return familyNames(raw);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function exportKey(key: string, file: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile('reg', ['export', key, file, '/y'], { windowsHide: true, timeout: 15000 }, error => error ? reject(error) : resolve());
  });
}

/** 解析 `reg export` 文本，返回每个字体条目的注册表值名（名称即“字体名 (类型)”）。 */
export function parseFontExport(text: string): string[] {
  const names: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith('"')) continue;
    // 只接受 REG_SZ 的字符串值（`"名称"="数据"`）；REG_DWORD 等系统值被排除。
    const match = /^"((?:[^"\\]|\\.)*)"="((?:[^"\\]|\\.)*)"\s*$/.exec(line);
    if (!match) continue;
    names.push(match[1].replace(/\\(.)/g, '$1'));
  }
  return names;
}

/** 把注册表值名规范成字体族名（纯函数，便于测试）。 */
export function familyNames(raw: string[]): string[] {
  const families = new Map<string, string>();
  for (const name of raw) {
    const base = stripTypeSuffix(name);
    if (!base) continue;
    // “Microsoft YaHei & Microsoft YaHei UI (TrueType)” 这类值名包含多个字体族。
    for (const part of base.split('&')) {
      const family = stripStyle(part.trim());
      if (!family || family.length > 80 || /[,\\]/.test(family) || family.startsWith('@')) continue;
      const key = family.toLowerCase();
      if (!families.has(key)) families.set(key, family);
    }
  }
  return [...families.values()].sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true }));
}

/** 去掉值名末尾的 “(TrueType) / (OpenType) / (All res)” 等安装类型说明。 */
export function stripTypeSuffix(name: string): string {
  const trimmed = name.trim();
  const start = trimmed.lastIndexOf('(');
  if (start >= 0 && trimmed.endsWith(')')) return trimmed.slice(0, start).trim();
  return trimmed;
}

/** 去掉样式后缀；“Arial Black”“Calibri Light”等是独立字体族，不在剥离列表中。 */
export function stripStyle(name: string): string {
  let family = name.trim();
  for (let guard = 0; guard < 4; guard++) {
    const lower = family.toLowerCase();
    const style = STYLE_SUFFIXES.find(item => lower.endsWith(` ${item.toLowerCase()}`));
    if (!style) break;
    family = family.slice(0, family.length - style.length - 1).trimEnd();
  }
  return family;
}
