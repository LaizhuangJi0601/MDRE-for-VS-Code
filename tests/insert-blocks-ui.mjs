// 用途：insert-blocks-ui 的插件宿主／界面验证。
import { chromium } from 'playwright';
import { preview } from './preview.mjs';
import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';

const {server,url}=await preview();
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const passed=[];
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
async function reset(original) {
  await page.evaluate(text=>window.testHost.external(text),original);
  await page.waitForFunction(text=>window.mdre.workspace.active.source===text&&window.mdre.workspace.active.renderRevision===window.mdre.workspace.active.revision,original);
  await page.evaluate(()=>{document.getElementById('error').textContent='';});
  await page.locator('#render .ProseMirror > p').first().click();
}
async function checkFollowing(index) {
  const children=await page.evaluate(()=>Array.from({length:window.mdre.render.state.doc.childCount},(_,i)=>({type:window.mdre.render.state.doc.child(i).type.name,size:window.mdre.render.state.doc.child(i).content.size})));
  assert.deepEqual(children[index+1],{type:'paragraph',size:0},'插入块后应有独立空段');
  const paragraph=page.locator('#render .ProseMirror > p').filter({hasNotText:/\S/}).first();
  await paragraph.click();await page.keyboard.insertText('独立段落');
  await page.waitForFunction(()=>window.testHost.snapshot().text.includes('独立段落'));
  await page.keyboard.press('End');
  await page.waitForFunction(()=>window.mdre.render.state.selection.$from.parentOffset===4);
  for(let length=3;length>=0;length--) {
    await page.keyboard.press('Backspace');
    await page.waitForFunction(({index,text})=>window.mdre.render.state.doc.child(index+1).textContent===text,{index,text:'独立段落'.slice(0,length)});
    assert.equal(await page.locator('#error').textContent(),'');
  }
}
try {
  await page.goto(url);await page.waitForFunction(()=>!!window.mdre?.workspace.active);
  for(const [button,selector] of [['bullet','ul'],['ordered','ol'],['task','ul']] ) {
    for(const original of ['','正文\n\n后文\n','- 前项\n\n\n\n后文\n']) {
      await reset(original);
      await page.locator('#'+button).click();
      const error=await page.locator('#error').textContent();
      assert.equal(error,'',`${button} ${JSON.stringify(original)}`);
      assert(await page.locator('#render .ProseMirror > '+selector).count()>0);
      const listIndex=original.startsWith('-')?1:0;
      await checkFollowing(listIndex);
      passed.push(`${button} ${JSON.stringify(original)}`);
    }
  }
  for(const button of ['bullet','ordered','task','quote','rule','table','code-block','insert-mermaid']) {
    console.log(`验证右键插入：${button}`);
    await reset('正文\n\n后文\n');
    await page.locator('#render .ProseMirror > p').first().click({button:'right'});
    await page.locator('#editor-context [data-context="insert"]').click();
    assert.equal(await page.locator('[data-context="insert-html"],[data-context="insert-inline-html"]').count(),0);
    await page.locator('.context-submenu:not([hidden]) [data-context="'+button+'"]').click();
    if(button==='table')await page.locator('#table-confirm').click();
    if(button==='code-block')await page.locator('#code-confirm').click();
    if(button==='insert-mermaid') { assert.equal(await page.locator('#dialog').isVisible(),true); await page.locator('#confirm').click(); }
    assert.equal(await page.locator('#error').textContent(),'');
    const index=['rule','table','insert-mermaid'].includes(button)?1:0;
    await checkFollowing(index);
    assert.equal(await page.locator('#render .ProseMirror > p').last().textContent(),'后文');
    passed.push(`右键 ${button}：新增段落可输入及删空，后文保留`);
  }
  await reset('正文\n\n后文\n');
  await page.locator('#image-input').setInputFiles({name:'test.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jG1sAAAAASUVORK5CYII=','base64')});
  await page.waitForFunction(()=>window.testHost.snapshot().text.includes('![test]'));
  assert.equal(await page.locator('#error').textContent(),'');
  await checkFollowing(0);
  passed.push('图片插入：后续段落独立输入及删空');
  assert.deepEqual(errors,[]);
  await mkdir('output/playwright',{recursive:true});await writeFile('output/playwright/insert-blocks-results.json',JSON.stringify({passed,errors},null,2));
  console.log(JSON.stringify({passed,errors},null,2));
} catch(reason){console.error(await page.evaluate(()=>({source:window.mdre?.workspace.active.source,error:document.getElementById('error')?.textContent})));throw reason;}
finally{await browser.close();server.close();}
