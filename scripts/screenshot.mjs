import { chromium } from 'playwright';
import { preview } from '../tests/preview.mjs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'media/screenshots'); await mkdir(output, { recursive: true });
const { server, url } = await preview(), browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await page.goto(url); await page.waitForFunction(() => window.mdre?.workspace.active);
  const demo = '# MDRE 使用示例\n\n在 VS Code 中直接编辑 **Markdown**，也可以切换源码，内容双向同步。\n\n## 数学公式\n\n能量公式 $E=mc^2$，二次函数 $y=ax^2+bx+c$。\n\n## 表格与列表\n\n| 功能 | 支持 |\n| --- | --- |\n| 富文本与源码同步 | ✓ |\n| 公式和 Mermaid | ✓ |\n| A4 分页与导出 | ✓ |\n\n- [x] 编写 Markdown\n- [x] 可视化编辑公式\n- [ ] 导出分享\n\n## 代码示例\n\n```javascript\nconst message = "Hello, Markdown!";\nconsole.log(message);\n```\n';
  await page.evaluate(text => window.testHost.external(text), demo);
  await page.waitForFunction(() => window.mdre.workspace.active.renderRevision === window.mdre.workspace.active.revision);
  await page.locator('#source-toggle').click(); await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(output, 'editor.png') });
  await page.evaluate(text => window.testHost.external(text), '# A4 分页与缩放\n\n' + Array.from({ length: 85 }, (_, i) => `第 ${i + 1} 段：分页先按固定纸张尺寸排版，再整体缩放。页码从左到右、从上到下排列；富文本仍可直接编辑。`).join('\n\n'));
  await page.waitForFunction(() => window.mdre.workspace.active.renderRevision === window.mdre.workspace.active.revision);
  await page.locator('#source-toggle').click();
  await page.evaluate(() => document.getElementById('settings-open').click());
  await page.locator('[name="paper_enabled"]').selectOption('true'); await page.locator('[name="paper_layout"]').selectOption('paged'); await page.locator('#settings-save').click();
  await page.waitForFunction(() => Number(document.getElementById('render').dataset.pages) > 1);
  await page.locator('#render').evaluate(el => { const r = el.getBoundingClientRect(); el.dispatchEvent(new WheelEvent('wheel', { ctrlKey: true, deltaY: -Math.log(.45)/.002, bubbles: true, cancelable: true, clientX:r.left+100,clientY:r.top+100 })); });
  await page.waitForFunction(() => document.getElementById('render').dataset.columns === '3');
  await page.locator('#render').evaluate(el => el.scrollTop = 0); await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(output, 'a4-pages.png') });
  console.log('已生成公开示例截图：editor.png、a4-pages.png');
} finally { await browser.close(); server.close(); }
