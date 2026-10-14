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
window.acquireVsCodeApi = () => ({ getState: () => state, setState: value => state = value, postMessage: message => {
  if(message.type === 'reload-ready') { window.testReloaded = true; return; }
  let value, error;
  try {
    const args = message.args;
    switch(message.command) {
      case 'document': value = snapshot(); break;
      case 'read_settings': value = settings; break;
      case 'write_settings': settings = args.settings; localStorage.setItem('mdre-test-settings', JSON.stringify(settings)); value = null; break;
      case 'edit':
        if(args.version !== version) { value = {...snapshot(),accepted:false}; break; }
        history.push(text); future = [];
        text = text.slice(0,args.from)+args.insert+text.slice(args.to); version++;
        value = {...snapshot(),accepted:true}; break;
      case 'undo': if(history.length) {future.push(text); text=history.pop(); version++;} value=snapshot(); break;
      case 'redo': if(future.length) {history.push(text); text=future.pop(); version++;} value=snapshot(); break;
      case 'save': savedText = text; value = snapshot(); break;
      case 'preserve_draft': window.testPreservedDraft=args.text; value=null; break;
      case 'save_image': value={relativePath:'assets/test.png',absolutePath:'D:/example/assets/test.png',resourceRoot:'D:/example/assets',bytes:1,hash:'test',deduplicated:false}; break;
      case 'read_document_image': value='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jG1sAAAAASUVORK5CYII='; break;
      case 'clipboard_write': window.testClipboard=args.text; value=null; break;
      case 'pick_export': window.testExportPick=args; value='D:/example/test.'+args.format; break;
      case 'export_pdf': window.testPdfSnapshot=args.html; value={path:args.path,bytes:1,engine:'test-transport'}; break;
      default: value = null;
    }
  } catch(reason) { error=String(reason); }
  setTimeout(() => window.postMessage({type:'rpc-result',id:message.id,value,error}, '*'), 0);
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
      if (injectMock && file.endsWith('index.html')) content = Buffer.from(content.toString().replace('<head>', `<head><script>${mock}</script>`));
      const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml' }[path.extname(file)] ?? 'application/octet-stream';
      response.writeHead(200, { 'Content-Type': mime }); response.end(content);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) console.log((await preview(1431)).url);
