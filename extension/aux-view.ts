// v0.3.0：VS Code 插件内的 PDF / Word 只读查看面板。
// 复用 dist/webview/viewer.html + src/viewer-app.ts（与桌面共用 PDF 查看器与 Word 渲染模块），
// 二进制文件通过宿主侧范围读取 / 整文件读取提供，避免 webview 直接持有 fs 权限。
import * as vscode from 'vscode';
import { readFileSync } from 'node:fs';
import { open, readFile, stat } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';

export const AUX_VIEW_TYPE = 'mdre.aux';
const MAX_RANGE = 4 * 1024 * 1024;
const MAX_WHOLE_FILE = 64 * 1024 * 1024;
type AuxDocument = vscode.CustomDocument & { readonly uri: vscode.Uri };

export function createAuxProvider(context: vscode.ExtensionContext, language: () => string): vscode.CustomReadonlyEditorProvider<AuxDocument> {
  return {
    openCustomDocument(uri) { return { uri, dispose() { /* 无资源需要释放 */ } }; },
    resolveCustomEditor(document, panel) { resolve(context, document, panel, language); },
  };
}

export function registerAuxView(context: vscode.ExtensionContext, language: () => string) {
  const provider = createAuxProvider(context, language);
  context.subscriptions.push(vscode.window.registerCustomEditorProvider(AUX_VIEW_TYPE, provider, {
    webviewOptions: { retainContextWhenHidden: true }, supportsMultipleEditorsPerDocument: false,
  }));
  return provider;
}

function cspFor(source: string, nonce: string) {
  return `default-src 'none'; img-src ${source} data:; style-src ${source} 'unsafe-inline'; script-src 'nonce-${nonce}' ${source}; font-src ${source} data:; connect-src ${source}; worker-src ${source} blob:;`;
}

function resolve(context: vscode.ExtensionContext, document: AuxDocument, panel: vscode.WebviewPanel, language: () => string) {
  const root = vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview');
  const folder = vscode.Uri.joinPath(document.uri, '..');
  panel.webview.options = { enableScripts: true, localResourceRoots: [context.extensionUri, folder] };
  let html = readFileSync(vscode.Uri.joinPath(root, 'viewer.html').fsPath, 'utf8');
  const nonce = randomBytes(16).toString('hex');
  html = html.replace(/(src|href)="(\.\/[^"]+)"/g, (_match, attribute, value) => `${attribute}="${panel.webview.asWebviewUri(vscode.Uri.joinPath(root, value.slice(2)))}"`);
  html = html.replace(/<script /g, `<script nonce="${nonce}" `);
  html = html.replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="${cspFor(panel.webview.cspSource, nonce)}">`);
  panel.webview.html = html;
  const filePath = document.uri.fsPath;
  const kind = path.extname(filePath).toLowerCase() === '.pdf' ? 'pdf' : 'docx';
  panel.title = path.basename(filePath);
  const listener = panel.webview.onDidReceiveMessage(async message => {
    if (message?.type !== 'aux-rpc' || !Number.isInteger(message.id)) return;
    const reply = (value: Record<string, unknown>) => panel.webview.postMessage({ type: 'aux-result', id: message.id, ...value });
    try {
      const command = String(message.command ?? '');
      if (command === 'init') { await panel.webview.postMessage({ type: 'aux-init', kind, path: filePath, language: language() }); return; }
      if (command === 'length') { reply({ value: (await stat(filePath)).size }); return; }
      if (command === 'readAll') {
        const info = await stat(filePath);
        if (info.size > MAX_WHOLE_FILE) throw new Error('文件超过 64 MB，暂时无法在编辑器内查看。');
        reply({ base64: (await readFile(filePath)).toString('base64') }); return;
      }
      if (command === 'readRange') {
        const start = Math.max(0, Number(message.args?.start ?? 0));
        const end = Math.max(start, Number(message.args?.end ?? start));
        const length = Math.min(MAX_RANGE, end - start);
        if (!length) { reply({ base64: '' }); return; }
        const handle = await open(filePath, 'r');
        try {
          const buffer = Buffer.alloc(length);
          const { bytesRead } = await handle.read(buffer, 0, length, start);
          reply({ base64: buffer.subarray(0, bytesRead).toString('base64') });
        } finally { await handle.close(); }
        return;
      }
      throw new Error('未知的查看请求。');
    } catch (reason) {
      reply({ error: reason instanceof Error ? reason.message : String(reason) });
    }
  });
  panel.onDidDispose(() => listener.dispose());
  void panel.webview.postMessage({ type: 'aux-boot' });
}

export async function openAuxDocument(uri: vscode.Uri) {
  await vscode.commands.executeCommand('vscode.openWith', uri, AUX_VIEW_TYPE);
}
