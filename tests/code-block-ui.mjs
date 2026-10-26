// 用途：code-block-ui 的插件宿主／界面验证。
import { chromium } from 'playwright';
import { preview } from './preview.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const desktop = false;
const directory = undefined;
const { server, url } = await preview(0, directory, !desktop);
const browser = await chromium.launch({ channel:'msedge',headless:true });
const page = await browser.newPage({ viewport:{width:1440,height:1000} });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const passed = [];
let remaining = -1;
try {
  await page.goto(url);
  await page.waitForFunction(() => !!window.mdre);
  if(desktop) await page.evaluate(() => window.mdre.newBlankTab());
  async function reset() {
    const text='代码内容\n\n后续原文\n';
    if(desktop) await page.evaluate(text => {
      const {source}=window.mdre;
      source.dispatch({changes:{from:0,to:source.state.doc.length,insert:text}});
    },text);
    else await page.evaluate(text => window.testHost.external(text),text);
    await page.waitForFunction(() => window.mdre.workspace.active.renderRevision===window.mdre.workspace.active.revision && window.mdre.render.dom.textContent.includes('代码内容'));
    await page.evaluate(() => { document.getElementById('error').textContent=''; });
    await page.locator('#render .ProseMirror p').filter({hasText:'代码内容'}).click();
    await page.locator('#code-block').click();
    await page.locator('#code-confirm').click();
    await page.locator('#render .code-block').waitFor();
    assert.equal(await page.locator('#render .ProseMirror > p').count(),2);
  }
  async function remove() {
    await page.locator('#render .code-header').click({button:'right'});
    await page.locator('#editor-context [data-context="block-operations"]').click();
    await page.locator('.context-submenu:not([hidden]) [data-context="block-delete"]').click();
    await page.waitForFunction(() => !window.mdre.render.dom.querySelector('.code-block'));
    assert.equal(await page.locator('#error').textContent(),'');
  }
  await reset();
  await remove();
  assert.equal(await page.locator('#render .ProseMirror > p').count(),2);
  assert.equal(await page.locator('#render .ProseMirror > p').first().textContent(),'');
  assert.equal(await page.locator('#render .ProseMirror > p').last().textContent(),'后续原文');
  passed.push('插入后可直接用右键删除代码块，保留新增空段与后文');
  await page.locator('#render .ProseMirror > p').first().click();
  await page.keyboard.insertText('独立段落');
  await page.waitForFunction(() => window.mdre.workspace.active.source.includes('独立段落'));
  passed.push('删除代码块后保留的空段可继续输入');

  await reset();
  await page.locator('#render .ProseMirror > p').first().click();
  await page.keyboard.insertText('独立段落');
  await page.waitForFunction(() => window.mdre.workspace.active.source.includes('独立段落'));
  await remove();
  const paragraph=page.locator('#render .ProseMirror > p').first();
  await paragraph.click(); await page.keyboard.press('End');
  // End 改变浏览器原生选区后，等待 selectionchange 同步至 ProseMirror 再发下一按键。
  await page.waitForFunction(() => window.mdre.render.state.selection.from===window.mdre.workspace.active.model.doc.firstChild.nodeSize-1);
  for(let length=3;length>=0;length--) {
    remaining = length;
    await page.keyboard.press('Backspace');
    await page.waitForFunction(expected => window.mdre.render.dom.querySelector('p').textContent===expected,'独立段落'.slice(0,length));
    assert.equal(await page.locator('#error').textContent(),'');
  }
  await page.keyboard.insertText('重新输入');
  await page.waitForFunction(() => window.mdre.workspace.active.source.includes('重新输入'));
  assert.equal(await page.locator('#render .ProseMirror > p').last().textContent(),'后续原文');
  passed.push('新增段落写字后可删除代码块，文字可删至一个字、删空并重新输入');
  assert.deepEqual(errors,[]);
  await mkdir('output/playwright',{recursive:true});
  const name=desktop?'desktop-code-block':'plugin-code-block';
  await writeFile(`output/playwright/${name}-results.json`,JSON.stringify({passed,errors},null,2));
  console.log(JSON.stringify({mode:name,passed,errors},null,2));
} catch(reason) {
  console.error(await page.evaluate(remaining=>({remaining,source:window.mdre?.workspace.active.source,model:JSON.stringify(window.mdre?.workspace.active.model.doc.toJSON()),render:JSON.stringify(window.mdre?.render.state.doc.toJSON()),native:window.getSelection()?.anchorNode?.textContent,offset:window.getSelection()?.anchorOffset,focus:window.getSelection()?.focusOffset,selection:window.mdre?.render.state.selection.toJSON(),error:document.getElementById('error')?.textContent,active:document.activeElement?.outerHTML.slice(0,160)}),remaining));
  throw reason;
} finally { await browser.close(); server.close(); }
