// 用途：pdf-export 的插件宿主／界面验证。
import { chromium } from 'playwright';
import {createRequire as testRequire} from 'node:module';
const {build}=testRequire(new URL('../package.json',import.meta.url))('esbuild');
import { createRequire } from 'node:module';
import { mkdir,writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { preview } from './preview.mjs';

const output='output/pdf';await mkdir(output,{recursive:true});
await build({entryPoints:['extension/pdf.ts'],outfile:'out/pdf-test.cjs',bundle:true,platform:'node',format:'cjs',external:['./pdf-engine']});
const {pdfBytes}=createRequire(import.meta.url)('../out/pdf-test.cjs');
const formula=String.raw`\begin{aligned}
H_{u,s,n',m',n,m}^{k,p}(t)&=\sqrt{P_{n',m',n,m}^{k,p}}\left[\begin{matrix}F_{rx,u,\theta}(\theta_{rx,n',m',ZOA}^{k,p},\phi_{rx,n',m',AOA}^{k,p})\\F_{rx,u,\phi}(\theta_{rx,n',m',ZOA}^{k,p},\phi_{rx,n',m',AOA}^{k,p})\end{matrix}\right]^{\mathrm T}\\
&\quad\frac{CPM_{rx,n',m'}^{k,p}\,CPM_{n',m',n,m}^{k,p}\,CPM_{tx,n,m}^{k,p}}{\sqrt{(\lvert d^{\theta\theta}\rvert^2+\lvert d^{\phi\phi}\rvert^2)/2}}\left[\begin{matrix}F_{tx,s,\theta}(\theta_{tx,n,m,ZOD}^{k,p},\phi_{tx,n,m,AOD}^{k,p})\\F_{tx,s,\phi}(\theta_{tx,n,m,ZOD}^{k,p},\phi_{tx,n,m,AOD}^{k,p})\end{matrix}\right]\\
&\quad\exp\left(j2\pi\frac{\vec r_{rx,k,p,n',m'}^{\mathrm T}(\tilde t)\cdot\vec d_{rx,u}+\vec r_{tx,k,p,n,m}^{\mathrm T}(\tilde t)\cdot\vec d_{tx,s}}{\lambda_0}\right)\\
&\quad\exp\left(j2\pi\int_{t_0}^{t} f_{D,n',m',n,m}^{k,p}(\tilde t)\,\mathrm d\tilde t\right)
\end{aligned}\tag{3-1}`;
const code=['import torch','# CUDA 环境检查','print("CUDA 可用:", torch.cuda.is_available())',...Array.from({length:70},(_,i)=>`value_${i} = ${i}  # 第 ${i+1} 行`),'print("CODE_END_SENTINEL")'].join('\n');
const fixture='# PDF 导出验证\n\n这里是一段正文，下方展示一个数学公式：行内 $\\sqrt{x^2+1}$。\n\n$$\n'+formula+'\n$$\n\n```python\n'+code+'\n```\n\n```js\nconst value = 42;\nconsole.log("浅色代码");\n```\n\n```unknown-test-language\n<原文保持> & 最后一行\n```\n\nPDF_END_SENTINEL 最后一段。\n';
await writeFile(output+'/fixture.md',fixture);
const {server,url}=await preview();const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
try {
  await page.goto(url);await page.waitForFunction(()=>!!window.mdre?.workspace.active);
  await page.evaluate(text=>window.testHost.external(text),fixture);
  await page.waitForFunction(()=>window.mdre.workspace.active.renderRevision===window.mdre.workspace.active.revision&&!!document.querySelector('.code-copy'));
  assert.equal(await page.locator('.code-actions').count(),3);
  const first=page.locator('#render .code-block').first();
  await first.locator('.code-copy').click();
  await page.waitForFunction(expected=>window.testClipboard===expected,code);
  assert.equal(await first.locator('.inline-code-editor').isVisible(),false,'折叠的长代码仍应复制全部内容');
  await first.locator('.code-theme-toggle').click();
  assert.equal(await first.getAttribute('data-code-theme'),'dark');
  assert.equal(await page.locator('#render .code-block').nth(1).evaluate(element=>getComputedStyle(element).getPropertyValue('--code-bg').trim()),'#f6f7f8');
  assert.equal(await page.evaluate(()=>window.mdre.workspace.active.source),fixture,'切换主题不改源码');
  const editorMath=await page.locator('#render .math-block .katex').evaluate(element=>({html:element.innerHTML,fontSize:getComputedStyle(element).fontSize,font:getComputedStyle(element).fontFamily,height:element.getBoundingClientRect().height}));
  await page.locator('#export-menu').click();await page.locator('#pdf-open').click();await page.locator('#pdf-dialog #pdf').click();
  await page.waitForFunction(()=>!!window.testPdfSnapshot);
  assert.equal(await page.evaluate(()=>window.testExportPick.format),'pdf');
  const html=await page.evaluate(()=>window.testPdfSnapshot);
  assert(!html.includes('url(fonts/'),'字体必须内嵌');assert(html.includes('data:font/woff2;base64,'));
  await writeFile(output+'/plugin-snapshot.html',html);
  const printed=await browser.newPage({viewport:{width:680,height:1000}});
  await printed.setContent(html);await printed.evaluate(()=>document.fonts.ready);
  assert.equal(await printed.locator('.math-block .katex').innerHTML(),editorMath.html,'编辑及导出使用相同 KaTeX 节点');
  const printMath=await printed.locator('.math-block .katex').evaluate(element=>({fontSize:getComputedStyle(element).fontSize,font:getComputedStyle(element).fontFamily,height:element.getBoundingClientRect().height}));
  assert.equal(printMath.font,editorMath.font);
  const scale=parseFloat(printMath.fontSize)/parseFloat(editorMath.fontSize);
  assert(scale<=1.001);assert(Math.abs(printMath.height-editorMath.height*scale)<1,'页宽缩放只改变大小，保留渲染比例');
  const separation=await printed.locator('.math-block').evaluate(block=>{
    const base=block.querySelector('.katex-html > .base').getBoundingClientRect(),tag=block.querySelector('.tag').getBoundingClientRect();
    return tag.left-base.right;
  });assert(separation>0,'编号与最长公式行分离');
  assert.equal(await printed.locator('.code-header').first().textContent(),'Python');
  const colors=await printed.locator('.hljs-keyword').evaluateAll(elements=>elements.map(element=>getComputedStyle(element).color));
  assert(colors.includes('rgb(255, 123, 114)'));assert(colors.includes('rgb(180, 35, 99)'));
  await page.locator('#render .math-block').screenshot({path:output+'/editor-formula.png'});
  await printed.locator('.math-block').screenshot({path:output+'/export-formula.png'});
  const bytes=await pdfBytes(html);await writeFile(output+'/plugin.pdf',bytes);
  await first.locator('.code-delete').click();
  await page.waitForFunction(()=>!window.mdre.workspace.active.source.includes('CODE_END_SENTINEL'));
  assert.equal(await page.locator('#error').textContent(),'');
  await page.locator('#undo').click();await page.waitForFunction(()=>window.mdre.workspace.active.source.includes('CODE_END_SENTINEL'));
  assert.deepEqual(errors,[]);
  const report={bytes:bytes.length,editorMath,printMath,scale,colors,passed:['插件 PDF 按钮调用宿主接口','字体全部离线内嵌，公式节点和渲染比例一致，编号不重叠','深浅代码颜色和语言标签','折叠长代码全量复制','单块主题不改源码','按钮删除整块并可撤销'],errors};
  delete report.editorMath.html;await writeFile(output+'/results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();server.close();}
