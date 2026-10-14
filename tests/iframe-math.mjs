import { chromium } from 'playwright';
import { preview } from './preview.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const { server, url } = await preview();
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const passed = [];
try {
  await page.goto(url + '/framed');
  await page.waitForSelector('iframe');
  const frame = await page.locator('iframe').contentFrame();
  await frame.locator('#render .math-inline').waitFor();
  // 明确验证跨域 iframe；普通顶层浏览器不能覆盖 VS Code 的 Webview 键盘行为。
  const state = await frame.locator('body').evaluate(() => {
    let crossOrigin = false;
    try { void window.top.document; } catch { crossOrigin = true; }
    return { iframe: window !== window.top, crossOrigin };
  });
  assert.deepEqual(state, { iframe: true, crossOrigin: true });
  async function open(selector) {
    await frame.locator(selector).dblclick();
    await frame.locator('#math-dialog[open]').waitFor();
    await frame.locator('#math-dialog').evaluate(async () => {
      while (document.getElementById('math-error').textContent === '正在加载公式编辑器…') await new Promise(resolve => setTimeout(resolve, 20));
    });
    const problem = await frame.locator('#math-error').textContent();
    if (problem) {
      console.error(await frame.locator('body').evaluate(() => {
        let cause;
        try { window.mathVirtualKeyboard.container = document.getElementById('math-keyboard'); } catch (error) { cause = error.message; }
        return { displayed:document.getElementById('math-error').textContent, cause };
      }));
    }
    assert.equal(problem, '');
    assert.equal(await frame.locator('#math-confirm').isEnabled(), true);
    assert.equal(await frame.locator('#math-keyboard .ML__keyboard').count(), 1);
  }
  await open('#render .math-inline');
  await frame.locator('#math-field').evaluate(field => { field.value = 'x^3'; });
  await frame.locator('#math-confirm').click();
  await frame.locator('body').evaluate(async () => {
    while (!window.testHost.snapshot().text.includes('$x^3$')) await new Promise(resolve => setTimeout(resolve, 20));
  });
  passed.push('跨域 iframe 行内公式可编辑，键盘在 Webview 内，确认写回文档');

  const sample = '# 论文公式\n\n目标信道 $h_{\\mathrm{target}}(\\tau;t)$\n\n$$\ny(t)=\\int_{-\\infty}^{\\infty} h_{\\mathrm{target}}(\\tau;t)\\,s(t-\\tau)\\,\\mathrm{d}\\tau + c_{\\mathrm{rx}}(t) + w(t) \\tag{1}\n$$\n';
  await frame.locator('body').evaluate((_body, text) => window.testHost.external(text), sample);
  await open('#render .math-inline');
  await frame.locator('#math-confirm').click();
  assert.equal(await frame.locator('body').evaluate(() => window.testHost.snapshot().text), sample);
  await open('#render .math-block');
  await frame.locator('#math-confirm').click();
  assert.equal(await frame.locator('body').evaluate(() => window.testHost.snapshot().text), sample);
  passed.push('论文中的目标信道行内公式和带编号积分公式可打开，直接确认保持原文');

  const original = '# 块级公式\r\n\r\n$$\r\nx^2 \\tag{1}\r\n$$\r\n\r\n原文保留\r\n';
  await frame.locator('body').evaluate((_body, text) => window.testHost.external(text), original);
  await frame.locator('#render .math-block').waitFor();
  await open('#render .math-block');
  await frame.locator('#math-field').evaluate(field => { field.value = 'x^3'; });
  await frame.locator('#math-number').fill('2');
  await frame.locator('#math-confirm').click();
  await frame.locator('body').evaluate(async () => {
    while (!window.testHost.snapshot().text.includes('x^3') || !window.testHost.snapshot().text.includes('\\tag{2}')) await new Promise(resolve => setTimeout(resolve, 20));
  });
  const changed = await frame.locator('body').evaluate(() => window.testHost.snapshot().text);
  assert(changed.startsWith('# 块级公式\r\n\r\n$$\r\n'));
  assert(changed.endsWith('$$\r\n\r\n原文保留\r\n'));
  passed.push('跨域 iframe 块级公式及编号可编辑，保留分隔符、CRLF 与相邻原文');
  await frame.locator('#undo').click();
  await frame.locator('body').evaluate(async (_body, expected) => {
    while (window.testHost.snapshot().text !== expected) await new Promise(resolve => setTimeout(resolve, 20));
  }, original);
  await open('#render .math-block');
  await frame.locator('#math-field').evaluate(field => { field.value = 'x^4'; });
  await frame.locator('#math-cancel').click();
  assert.equal(await frame.locator('body').evaluate(() => window.testHost.snapshot().text), original);
  passed.push('确认修改可撤销；取消与重复打开不改写文档');
  assert.deepEqual(errors, []);
  await mkdir('output/playwright', { recursive: true });
  await writeFile('output/playwright/iframe-math-results.json', JSON.stringify({ passed, errors }, null, 2));
  console.log(JSON.stringify({ passed, errors }, null, 2));
} finally { await browser.close(); server.close(); }
