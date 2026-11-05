import './style.css';
import './formats/formats.css';
import './pdf/viewer.css';
import './viewer-app.css';
import { PdfViewer } from './pdf';
import { renderDocx } from './formats';
import { pdfAssetUrls } from './ui/pdf-assets';

// v0.3.0：VS Code 插件内的 PDF / Word 只读查看页。
// 宿主通过 aux-rpc 提供文件范围读取与整文件读取；本页与桌面共用 PDF 查看器与 Word 渲染模块。
type VSCodeApi = { postMessage(message: unknown): void };
declare const acquireVsCodeApi: () => VSCodeApi;
const api = acquireVsCodeApi();
const pending = new Map<number, { resolve(value: unknown): void; reject(reason: Error): void }>();
let serial = 0;
function rpc<T = unknown>(command: string, args: Record<string, unknown> = {}): Promise<T> {
  const id = ++serial;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
    api.postMessage({ type: 'aux-rpc', id, command, args });
  });
}
function decodeBase64(text: string): Uint8Array {
  const binary = atob(text || '');
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
const labels = (language: string): Record<string, string> => language === 'en' ? {} : ({
  loading: '正在载入 PDF', loadingPercent: '正在载入 PDF {percent}%',
  zoomIn: '放大', zoomOut: '缩小', zoomLevel: '缩放 {percent}%',
  pageOf: '{page} / {pages}', goToPage: '跳到第 {page} 页', page: '第 {page} 页', thumbnails: '页面缩略图',
  errorTitle: '无法打开 PDF', errorInvalid: '此文件不是有效的 PDF。', errorPassword: '此 PDF 受密码保护，暂不支持打开。',
  errorRead: '无法读取 PDF 文件。', errorRender: 'PDF 页面渲染失败。', errorUnknown: '无法打开 PDF。',
});
const root = document.getElementById('aux-root')!;
function paintTheme() {
  const dark = document.body.classList.contains('vscode-dark') || document.body.classList.contains('vscode-high-contrast');
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.codeTheme = dark ? 'dark' : 'light';
}
paintTheme();
window.addEventListener('message', event => {
  const message = event.data;
  if (message?.type === 'aux-result') {
    const request = pending.get(message.id); if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(String(message.error)));
    else if (typeof message.base64 === 'string') request.resolve(decodeBase64(message.base64));
    else request.resolve(message.value);
    return;
  }
  if (message?.type === 'aux-init') void start(String(message.kind), String(message.path), String(message.language ?? 'zh-CN'));
});

async function start(kind: string, filePath: string, language: string) {
  paintTheme();
  const languageLabels = labels(language);
  if (kind === 'docx') {
    root.classList.add('aux-docx-page');
    const status = document.createElement('p');
    status.className = 'dialog-hint';
    status.textContent = '正在载入 Word 文档…';
    root.append(status);
    try {
      const buffer = await rpc<Uint8Array>('readAll');
      const rendered = await renderDocx(buffer.buffer as ArrayBuffer, { labels: languageLabels });
      root.replaceChildren();
      const article = document.createElement('article');
      article.className = 'formats-docx aux-docx';
      article.innerHTML = rendered.html;
      root.append(article);
      if (rendered.warnings.length) status.textContent = rendered.warnings[0];
    } catch (reason) {
      status.textContent = reason instanceof Error ? reason.message : String(reason);
    }
    return;
  }
  // PDF：左侧页面缩略图 + 右侧查看器。
  const sidebar = document.createElement('aside');
  sidebar.className = 'aux-pdf-sidebar';
  const thumbs = document.createElement('div');
  thumbs.className = 'aux-pdf-thumbs';
  sidebar.append(thumbs);
  const viewerHost = document.createElement('div');
  viewerHost.className = 'aux-pdf-main';
  root.classList.add('aux-pdf-page');
  root.append(sidebar, viewerHost);
  const viewer = new PdfViewer(viewerHost, pdfAssetUrls(), {
    onError: error => { viewerHost.replaceChildren(Object.assign(document.createElement('p'), { className: 'dialog-hint', textContent: error.message })); },
  });
  viewer.setLabels(languageLabels);
  const length = await rpc<number>('length');
  await viewer.open({ length, readRange: async (start, end) => rpc<Uint8Array>('readRange', { start, end }) });
  viewer.mountThumbnails(thumbs);
}
void api.postMessage({ type: 'aux-rpc', id: ++serial, command: 'init', args: {} });
// 读取失败时由渲染函数兜底；这里保持事件循环可继续处理宿主消息。
window.addEventListener('error', event => { root.textContent = event.message; });
