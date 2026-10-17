import type { BrowserType } from 'playwright-core';
import { existsSync } from 'node:fs';
import path from 'node:path';

// 引擎随扩展放在 out/pdf-engine，调用系统浏览器；无需用户下载 Chromium。
const { chromium } = require('./pdf-engine') as { chromium: BrowserType };
export function pdfBrowserPath(configured?: string): string {
  if (configured) {
    if (!existsSync(configured)) throw new Error(`PDF 浏览器路径不存在：${configured}`);
    return configured;
  }
  const candidates = process.platform === 'win32' ? [
    ...[process.env['PROGRAMFILES(X86)'],process.env.PROGRAMFILES,process.env.LOCALAPPDATA].filter(Boolean).flatMap(folder=>[
      path.join(folder!,'Microsoft','Edge','Application','msedge.exe'),path.join(folder!,'Google','Chrome','Application','chrome.exe')]),
  ] : process.platform === 'darwin' ? [
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ] : ['/usr/bin/microsoft-edge','/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'];
  const executable = candidates.find(candidate=>existsSync(candidate));
  if (!executable) throw new Error('PDF 导出需要 Microsoft Edge 或 Google Chrome。请安装浏览器，或设置 mdre.pdf.browserPath。');
  return executable;
}
export async function pdfBytes(html: string, configured?: string, layout: 'paged' | 'long' = 'paged'): Promise<Buffer> {
  const browser=await chromium.launch({executablePath:pdfBrowserPath(configured),headless:true,timeout:30000});
  try {
    const page=await browser.newPage({viewport:{width:680,height:1123}});
    page.setDefaultTimeout(60000);
    // 快照自带图片和字体；禁止它访问本机文件或网络。
    await page.route('**/*',route=>route.abort());
    await page.setContent(html,{waitUntil:'load',timeout:60000});
    await page.emulateMedia({media:'print'});
    await page.evaluate(async()=>{
      await document.fonts.ready;
      await Promise.all(Array.from(document.images,image=>image.decode()));
      await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
      const failed=Array.from(document.fonts).filter(font=>font.status==='error');
      if (failed.length) throw new Error(`公式字体加载失败：${failed.map(font=>font.family).join(', ')}`);
    });
    if (layout === 'long') {
      const height = await page.evaluate(() => {
        document.body.style.width = '180mm';
        const bottom = document.body.getBoundingClientRect().bottom + parseFloat(getComputedStyle(document.body.lastElementChild ?? document.body).marginBottom || '0');
        return Math.ceil(Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, bottom) * 25.4 / 96 + 34);
      });
      if (height > 5080) throw new Error('全文超过打印引擎的单页长度上限（5.08 米），请选择分页导出。');
      await page.addStyleTag({ content: `@page { size:210mm ${Math.max(50,height)}mm; margin:15mm }` });
    }
    const bytes=await page.pdf({format:'A4',margin:{top:'15mm',bottom:'15mm',left:'15mm',right:'15mm'},preferCSSPageSize:true,printBackground:true,displayHeaderFooter:false});
    if (!bytes.subarray(0,5).equals(Buffer.from('%PDF-')) || !bytes.includes(Buffer.from('%%EOF'))) throw new Error('打印引擎没有生成完整 PDF。');
    return bytes;
  } finally { await browser.close(); }
}
