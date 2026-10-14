import { chromium } from 'playwright';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdir,writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { preview } from './preview.mjs';

const output='output/pdf';await mkdir(output,{recursive:true});
await build({entryPoints:['extension/pdf.ts'],outfile:'out/pdf-test.cjs',bundle:true,platform:'node',format:'cjs',external:['./pdf-engine']});
const {pdfBytes}=createRequire(import.meta.url)('../out/pdf-test.cjs');
const source=[
  '# 任务清单与行内代码','',
  '可以插入行内代码：`import torch; print(torch.cuda.is_available())`','',
  '- [ ] 这是任务清单','- [ ] 任务1','- [x] 任务2（已完成）','  - [X] 嵌套已完成任务','',
  '> - [ ] 引用中的任务','',
  '- 普通列表','- \\[ \\] 转义的普通文本','- `[ ] 代码中的标记`','',
  '| 类型 | 示例 |','| --- | --- |','| 行内代码 | `value = 42` |','',
  '```python','print("这是代码块")','```','',
].join('\n');
await writeFile(output+'/task-inline-fixture.md',source);
const {server,url}=await preview();const browser=await chromium.launch({channel:'msedge',headless:true});
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  await page.goto(url);await page.waitForFunction(()=>!!window.mdre?.workspace.active);
  await page.evaluate(text=>window.testHost.external(text),source);
  await page.waitForFunction(()=>window.mdre.workspace.active.renderRevision===window.mdre.workspace.active.revision);
  const html=await page.evaluate(()=>window.mdre.staticHtml(window.mdre.workspace.active.source));
  const print=await browser.newPage({viewport:{width:680,height:1000}});
  await print.setContent(html);await print.evaluate(()=>document.fonts.ready);
  assert.equal(await print.locator('.task-toggle').count(),5);
  assert.equal(await print.locator('.task-toggle[aria-checked="true"]').count(),2);
  assert.equal(await print.locator('.task-toggle[aria-checked="false"]').count(),3);
  assert.equal(await print.locator('li.task-item').first().evaluate(element=>getComputedStyle(element).listStyleType),'none');
  assert(!(await print.locator('li.task-item').first().textContent()).includes('[ ]'));
  assert((await print.locator('body').textContent()).includes('[ ] 转义的普通文本'));
  assert((await print.locator('body').textContent()).includes('[ ] 代码中的标记'));
  const style=await print.locator('.inline-code').first().evaluate(element=>({background:getComputedStyle(element).backgroundColor,shadow:getComputedStyle(element).boxShadow,padding:getComputedStyle(element).padding}));
  assert.equal(style.background,'rgb(233, 233, 233)');assert.notEqual(style.shadow,'none');assert.equal(style.padding,'2px 4px');
  assert.equal(await print.locator('pre code.inline-code').count(),0);
  await writeFile(output+'/task-inline.html',html);
  await writeFile(output+'/task-inline.pdf',await pdfBytes(html));
  await print.screenshot({path:output+'/task-inline-browser.png',fullPage:true});
  console.log(JSON.stringify({passed:['未选及已选任务显示方块，嵌套和引用任务正确','普通列表与转义标记保持原文','行内代码保留灰色底板、底部阴影及内边距，代码块不受影响'],style},null,2));
}finally{await browser.close();server.close();}
