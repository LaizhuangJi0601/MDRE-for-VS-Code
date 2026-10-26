// 用途：preview 的插件宿主／界面验证。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist/webview');
const mock = `
let text = '# 双栏编辑验收\\n\\n正文内容\\n\\n| A | B |\\n| --- | --- |\\n| 一 | 二 |\\n\\n公式 $x^2$\\n';
let version = 1, savedText = text, history = [], future = [], state;
let settings = JSON.parse(localStorage.getItem('mdre-test-settings') || '{}');
const snapshot = () => ({ text, version, dirty:text !== savedText, savedText, path:'D:/example/document.md', title:'document.md' });
window.testHost = { snapshot, external(value) { text = value; version++; window.postMessage({type:'document',document:snapshot()}, '*'); } };
window.addEventListener('storage',event=>{if(event.key==='mdre-test-settings'){settings=JSON.parse(event.newValue||'{}');window.postMessage({type:'settings-changed'},'*');}});
window.acquireVsCodeApi = () => ({ getState: () => state, setState: value => state = value, postMessage: message => {
  if(message.type === 'reload-ready') { window.testReloaded = true; return; }
  let value, error;
  try {
    const args = message.args;
    switch(message.command) {
      case 'document': value = snapshot(); break;
      case 'read_settings': value = JSON.parse(localStorage.getItem('mdre-test-settings')||'{}'); break;
      case 'write_settings': settings = {...JSON.parse(localStorage.getItem('mdre-test-settings')||'{}'),...args.patch}; localStorage.setItem('mdre-test-settings', JSON.stringify(settings)); localStorage.removeItem('mdre-test-settings-draft'); value = null; break;
      case 'open_settings_window': window.open('/settings.html','mdre-settings');value=null;break;
      case 'close_settings': localStorage.removeItem('mdre-test-settings-draft');window.close();value=null;break;
      case 'settings_draft': localStorage.setItem('mdre-test-settings-draft',JSON.stringify(args.draft));value=null;break;
      case 'read_settings_draft': value=JSON.parse(localStorage.getItem('mdre-test-settings-draft')||'null');break;
      case 'detect_pandoc': value={path:'D:/test-only/pandoc.exe',version:'pandoc 2.12 (simulated host)'};break;
      case 'open_external': window.testExternalUrl=args.url;value=null;break;
      case 'edit':
        if(args.version !== version) { value = {...snapshot(),accepted:false}; break; }
        history.push(text); future = [];
        text = text.slice(0,args.from)+args.insert+text.slice(args.to); version++;
        value = {...snapshot(),accepted:true}; break;
      case 'undo': if(history.length) {future.push(text); text=history.pop(); version++;} value=snapshot(); break;
      case 'redo': if(future.length) {history.push(text); text=future.pop(); version++;} value=snapshot(); break;
      case 'save': savedText = text; value = snapshot(); break;
      case 'preserve_draft': window.testPreservedDraft=args.text; value=null; break;
      case 'pick_images': value=window.testImagePaths ?? []; break;
      case 'clipboard_image_paths': value=window.testClipboardPaths ?? []; break;
      case 'read_binary': window.testReadImagePath=args.path; value='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jG1sAAAAASUVORK5CYII='; break;
      case 'read_image': value='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jG1sAAAAASUVORK5CYII='; break;
      case 'save_image': value={relativePath:'',absolutePath:'D:/example/images/test.png',resourceRoot:'D:/example/assets',bytes:1,hash:'test',deduplicated:false}; break;
      case 'read_document_image': value='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jG1sAAAAASUVORK5CYII='; break;
      case 'clipboard_write': window.testClipboard=args.text; value=null; break;
      case 'pick_export': window.testExportPick=args; value='D:/example/test.'+args.format; break;
      case 'export_pdf': window.testPdfSnapshot=args.html; value={path:args.path,bytes:1,engine:'test-transport'}; break;
      default: value = null;
    }
  } catch(reason) { error=String(reason); }
  setTimeout(() => window.postMessage({type:'rpc-result',id:message.id,value,error}, '*'), message.command === 'save' ? window.testSaveDelay ?? 0 : 0);
} });
`;
export async function preview(port = 0, directory = root, injectMock = true) {
  directory = path.resolve(directory);
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (pathname === '/framed') {
        response.writeHead(200, { 'Content-Type': 'text/html' });
        response.end(`<html><body style="margin:0"><iframe title="MDRE Webview" sandbox="allow-scripts allow-same-origin allow-forms" src="http://localhost:${server.address().port}/" style="width:100vw;height:100vh;border:0"></iframe></body></html>`);
        return;
      }
      const file = path.resolve(directory, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!file.startsWith(directory + path.sep)) { response.writeHead(403).end(); return; }
      let content = await readFile(file);
      if (injectMock && file.endsWith('.html')) content = Buffer.from(content.toString().replace('<head>', `<head><script>${mock}</script>`));
      const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml' }[path.extname(file)] ?? 'application/octet-stream';
      response.writeHead(200, { 'Content-Type': mime }); response.end(content);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) console.log((await preview(1431)).url);
