// 用途：webview 的插件宿主／界面验证。
import { chromium } from 'playwright';
import { preview } from './preview.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const { server, url } = await preview();
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = [];
page.on('pageerror', reason => errors.push(reason.message));
const passed = [];
try {
  await page.goto(url);
  await page.waitForFunction(() => window.mdre?.workspace.active?.source.includes('双栏编辑验收') && window.mdre.workspace.active.renderRevision === window.mdre.workspace.active.revision);
  assert.equal(await page.locator('#source-pane').isVisible(), false);
  assert.equal(await page.locator('#divider').isVisible(), false);
  assert.equal(await page.locator('#render-pane').isVisible(), true);
  assert.equal(await page.locator('#render .ProseMirror').getAttribute('contenteditable'), 'true');
  const initial = await page.evaluate(() => window.testHost.snapshot().text);
  const wide = await page.locator('#render-pane').boundingBox();
  await page.locator('#render .ProseMirror p').filter({ hasText: '正文内容' }).click();
  await page.keyboard.press('End'); await page.keyboard.insertText('RICHONLY');
  await page.waitForFunction(() => window.testHost.snapshot().text.includes('RICHONLY') && window.mdre.source.state.doc.toString().includes('RICHONLY'));
  await page.locator('#undo').click();
  await page.waitForFunction(expected => window.testHost.snapshot().text === expected && window.mdre.workspace.active.source === expected, initial);
  await page.locator('#source-toggle').click();
  assert.equal(await page.locator('#source-pane').isVisible(), true);
  assert.equal(await page.locator('#divider').isVisible(), true);
  assert(wide.width > (await page.locator('#render-pane').boundingBox()).width);
  const beforeToggle = await page.evaluate(() => window.testHost.snapshot());
  await page.locator('#source-toggle').click();
  await page.locator('#source-pane').waitFor({state:'hidden'});
  assert.equal(await page.locator('#source-pane').isVisible(), false);
  assert.equal(await page.locator('#source-toggle').getAttribute('aria-label'), '显示源码');
  assert.deepEqual(await page.evaluate(() => window.testHost.snapshot()), beforeToggle);
  await page.locator('#source-toggle').click();
  passed.push('默认隐藏源码且富文本可编辑，隐藏时同步、撤销、再次显示保持内容，切换不修改文档');
  assert.equal(await page.locator('#format-toolbar #bold svg').count(), 1);
  passed.push('双栏可见，原 SVG 工具栏存在');

  await page.locator('#source .cm-content').click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type('\nSOURCE_EDIT');
  await page.waitForFunction(() => window.testHost.snapshot().text.includes('SOURCE_EDIT') && window.mdre.render.dom.textContent.includes('SOURCE_EDIT'));
  passed.push('源码编辑同步富文本与宿主文档');

  await page.locator('#render .ProseMirror p').filter({ hasText: '正文内容' }).click();
  await page.keyboard.press('End');
  await page.keyboard.type('RENDEREDIT');
  await page.waitForFunction(() => window.testHost.snapshot().text.includes('RENDEREDIT') && window.mdre.source.state.doc.toString().includes('RENDEREDIT'));
  passed.push('富文本编辑同步源码与宿主文档');

  await page.locator('#render .ProseMirror p').filter({ hasText: '正文内容' }).click({ button: 'right' });
  await page.locator('#editor-context:not([hidden])').waitFor();
  assert(await page.locator('#editor-context button').count() > 10);
  await page.keyboard.press('Escape');
  passed.push('原编辑区右键菜单可展开');

  const beforeBold = await page.evaluate(() => window.testHost.snapshot().text);
  await page.evaluate(() => {
    const { source } = window.mdre;
    const at = source.state.doc.toString().indexOf('正文内容');
    source.dispatch({ selection: { anchor: at, head: at + 4 } }); source.focus();
  });
  await page.locator('#bold').click();
  await page.waitForFunction(() => window.testHost.snapshot().text.includes('**正文内容**'));
  const afterBold = await page.evaluate(() => window.testHost.snapshot().text);
  await page.locator('#undo').click();
  await page.waitForFunction(expected => window.testHost.snapshot().text === expected && window.mdre.source.state.doc.toString() === expected, beforeBold);
  await page.locator('#redo').click();
  await page.waitForFunction(expected => window.testHost.snapshot().text === expected && window.mdre.source.state.doc.toString() === expected, afterBold);
  passed.push('格式工具栏编辑及宿主统一撤销/重做');

  await page.locator('#render td').first().click({ button: 'right' });
  await page.locator('#editor-context [data-context="table-operations"]').click();
  await page.locator('.context-submenu:not([hidden]) [data-context="row-below"]').click();
  await page.waitForFunction(() => window.mdre.render.dom.querySelectorAll('tr').length === 3 && window.testHost.snapshot().text === window.mdre.workspace.active.source);
  passed.push('原右键菜单插入表格行，双栏与宿主同步');

  await page.locator('#render .math-inline').dblclick();
  await page.locator('#math-field').waitFor();
  await page.evaluate(() => { document.getElementById('math-field').value = 'x^3'; });
  await page.locator('#math-confirm').click();
  await page.waitForFunction(() => window.testHost.snapshot().text.includes('$x^3$') && window.mdre.source.state.doc.toString().includes('$x^3$'));
  passed.push('MathLive 公式弹窗编辑写回源码与宿主');

  await page.evaluate(() => window.testHost.external('# 外部编辑\n\nEXTERNAL_EDIT\n'));
  await page.waitForFunction(() => window.mdre.source.state.doc.toString().includes('EXTERNAL_EDIT') && window.mdre.render.dom.textContent.includes('EXTERNAL_EDIT'));
  passed.push('宿主外部修改同步到两栏');

  await page.evaluate(() => window.postMessage({ type: 'reload' }, '*'));
  await page.waitForFunction(() => window.testReloaded);
  passed.push('开发刷新前完成文档提交');

  // 默认布局保存后在下一次打开生效，取消设置不改写持久化配置。
  let settingsPage;
  async function settingsDialog() {
    const popup=page.waitForEvent('popup');
    await page.locator('#settings-open').click();
    settingsPage=await popup;
    await settingsPage.locator('#settings-dialog[open]').waitFor();
    await settingsPage.locator('.settings-navigation button').filter({hasText:'编辑与文件'}).click();
  }
  await settingsDialog();
  await settingsPage.locator('[name="show_source"]').selectOption('true');
  await settingsPage.locator('#settings-save').click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('mdre-test-settings')).show_source===true);
  await page.reload();
  await page.waitForFunction(() => window.mdre?.workspace.active?.source.includes('双栏编辑验收'));
  assert.equal(await page.locator('#source-pane').isVisible(), true);
  await settingsDialog();
  await settingsPage.locator('[name="show_source"]').selectOption('false');
  await settingsPage.locator('#settings-save').click();
  await page.waitForFunction(() => document.getElementById('source-pane').hidden);
  await page.reload();
  await page.waitForFunction(() => window.mdre?.workspace.active?.source.includes('双栏编辑验收'));
  assert.equal(await page.locator('#source-pane').isVisible(), false);
  await settingsDialog();
  await settingsPage.locator('[name="show_source"]').selectOption('true');
  await settingsPage.locator('#settings-cancel').click();
  assert.equal(await page.locator('#source-pane').isVisible(), false);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('mdre-test-settings')).show_source), false);
  passed.push('设置默认显示/隐藏源码，保存后重新打开生效，取消不改写默认设置');

  await page.locator('#mode').click();
  await page.locator('[data-mode="read"]').click();
  assert.equal(await page.locator('#source-toggle').isDisabled(), true);
  await page.locator('#mode').click();
  await page.locator('[data-mode="edit"]').click();
  assert.equal(await page.locator('#source-toggle').isDisabled(), false);
  assert.equal(await page.locator('#source-pane').isVisible(), false);
  assert.equal(await page.locator('#render .ProseMirror').getAttribute('contenteditable'), 'true');
  passed.push('源码隐藏与阅读模式独立，切回编辑模式仍可编辑富文本');

  await page.evaluate(() => window.testHost.external('# MDRE 插件开发版\n\n源码与富文本可双向编辑。\n\n| 功能 | 状态 |\n| --- | --- |\n| 原工具栏图标 | 保留 |\n| 右键编辑菜单 | 保留 |\n\n公式 $x^2$\n'));
  await page.waitForFunction(() => window.mdre.workspace.active.renderRevision === window.mdre.workspace.active.revision);
  assert.deepEqual(errors, []);
  await mkdir('output/playwright', { recursive: true });
  await page.screenshot({ path: 'output/playwright/双栏编辑.png', fullPage: true });
  await writeFile('output/playwright/results.json', JSON.stringify({ passed, errors }, null, 2));
  console.log(JSON.stringify({ passed, errors }, null, 2));
} catch (reason) {
  await mkdir('output/playwright', { recursive: true });
  await page.screenshot({path:'output/playwright/webview-failure.png'});
  console.error(await page.evaluate(() => ({ source:window.mdre?.source.state.doc.toString(), model:window.mdre?.workspace.active?.source, render:window.mdre?.render.dom.textContent, host:window.testHost?.snapshot(), error:document.getElementById('error')?.textContent, active:document.activeElement?.outerHTML.slice(0,200) })));
  console.error(errors);
  throw reason;
} finally { await browser.close(); server.close(); }
