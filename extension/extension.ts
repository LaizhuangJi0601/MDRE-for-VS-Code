import * as vscode from 'vscode';
import { readFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';
import { pdfBytes } from './pdf';
import { absoluteImagePath } from '../src/image-path';
import { readImage, clipboardImagePaths } from './image-files';

const viewType = 'mdre.editor';
type PanelRecord = { document: vscode.TextDocument; panel: vscode.WebviewPanel; editing: boolean; savedText: string };

export function activate(context: vscode.ExtensionContext) {
  const provider = new MDREProvider(context);
  context.subscriptions.push(vscode.window.registerCustomEditorProvider(viewType, provider, {
    webviewOptions: { retainContextWhenHidden: true }, supportsMultipleEditorsPerDocument: true,
  }));
  context.subscriptions.push(vscode.commands.registerCommand('mdre.open', async (uri?: vscode.Uri) => {
    const target = uri ?? vscode.window.activeTextEditor?.document.uri ?? provider.activeDocument?.uri;
    if (target) await vscode.commands.executeCommand('vscode.openWith', target, viewType);
    else {
      const selected = await vscode.window.showOpenDialog({ canSelectMany: false, filters: { Markdown: ['md', 'markdown'] } });
      if (selected?.[0]) await vscode.commands.executeCommand('vscode.openWith', selected[0], viewType);
    }
  }));
  context.subscriptions.push(vscode.commands.registerCommand('mdre.new', () => provider.newDocument()));
  context.subscriptions.push(vscode.commands.registerCommand('mdre.reloadEditor', () => provider.requestReload()));
  for (const command of ['save', 'undo', 'redo'])
    context.subscriptions.push(vscode.commands.registerCommand(`mdre.${command}`, () => provider.requestCommand(command)));
  context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => provider.changed(event.document)));
  context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(document => provider.saved(document)));
  if (context.extensionMode === vscode.ExtensionMode.Development) {
    const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(context.extensionUri, 'dist/webview/.ready'));
    context.subscriptions.push(watcher, watcher.onDidChange(() => provider.requestReload()), watcher.onDidCreate(() => provider.requestReload()));
  }
}

export class MDREProvider implements vscode.CustomTextEditorProvider {
  private records = new Set<PanelRecord>();
  constructor(private context: vscode.ExtensionContext) {}
  get activeDocument() { return [...this.records].find(record => record.panel.active)?.document; }
  async newDocument() {
    const document = await vscode.workspace.openTextDocument({ language: 'markdown', content: '' });
    await vscode.commands.executeCommand('vscode.openWith', document.uri, viewType);
  }
  resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel) {
    const record: PanelRecord = { document, panel, editing: false, savedText: document.getText() };
    this.records.add(record);
    this.prepare(panel, document);
    const listener = panel.webview.onDidReceiveMessage(async message => {
      if (message.type === 'reload-ready') { this.prepare(panel, record.document); return; }
      if (message.type !== 'rpc' || !Number.isInteger(message.id)) return;
      try {
        const value = await this.command(record, message.command, message.args ?? {});
        await panel.webview.postMessage({ type: 'rpc-result', id: message.id, value });
      } catch (reason) {
        await panel.webview.postMessage({ type: 'rpc-result', id: message.id, error: reason instanceof Error ? reason.message : String(reason) });
      }
    });
    panel.onDidDispose(() => { listener.dispose(); this.records.delete(record); });
  }
  private prepare(panel: vscode.WebviewPanel, document: vscode.TextDocument) {
    const folder = vscode.Uri.joinPath(document.uri, '..');
    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri, folder, ...(vscode.workspace.workspaceFolders?.map(item => item.uri) ?? [])],
    };
    const root = vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview');
    let html = readFileSync(vscode.Uri.joinPath(root, 'index.html').fsPath, 'utf8');
    const nonce = randomBytes(16).toString('hex');
    html = html.replace(/(src|href)="(\.\/[^\"]+)"/g, (_match, attribute, value) => `${attribute}="${panel.webview.asWebviewUri(vscode.Uri.joinPath(root, value.slice(2)))}"`);
    html = html.replace(/<script /g, `<script nonce="${nonce}" `);
    const source = panel.webview.cspSource;
    // 现有受控格式、MathLive 和 Mermaid 会生成行内样式；文档 HTML 仍沿用 MDRE 白名单。
    const csp = `default-src 'none'; img-src ${source} data: https:; media-src ${source} https:; script-src 'nonce-${nonce}' ${source}; style-src ${source} 'unsafe-inline'; font-src ${source} data:; connect-src ${source} https:;`;
    html = html.replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="${csp}">`);
    html = html.replace('<body>', '<body data-vscode-context=\'{"preventDefaultContextMenuItems":true}\'>');
    panel.webview.html = html;
  }
  private state(record: PanelRecord) {
    const document = record.document;
    return { text: document.getText(), version: document.version, dirty: document.isDirty,
      savedText: record.savedText, path: document.isUntitled ? null : document.uri.fsPath,
      title: document.isUntitled ? '未命名.md' : path.basename(document.uri.fsPath) };
  }
  changed(document: vscode.TextDocument) {
    for (const record of this.records) if (record.document.uri.toString() === document.uri.toString() && !record.editing)
      void record.panel.webview.postMessage({ type: 'document', document: this.state(record) });
  }
  saved(document: vscode.TextDocument) {
    for (const record of this.records) if (record.document.uri.toString() === document.uri.toString()) {
      record.savedText = document.getText();
      void record.panel.webview.postMessage({ type: 'document', document: this.state(record) });
    }
  }
  requestReload() { for (const record of this.records) void record.panel.webview.postMessage({ type: 'reload' }); }
  requestCommand(command: string) {
    const record = [...this.records].find(item => item.panel.active);
    if (record) void record.panel.webview.postMessage({ type: 'command', command });
  }
  private async command(record: PanelRecord, command: string, args: any): Promise<unknown> {
    const document = record.document;
    switch (command) {
      case 'document': return this.state(record);
      case 'edit': {
        if (!Number.isInteger(args.version) || !Number.isInteger(args.from) || !Number.isInteger(args.to) || typeof args.insert !== 'string') throw new Error('编辑补丁参数无效。');
        if (args.version !== document.version) return { ...this.state(record), accepted: false };
        if (args.from < 0 || args.to < args.from || args.to > document.getText().length) throw new Error('编辑范围超出文档。');
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, new vscode.Range(document.positionAt(args.from), document.positionAt(args.to)), args.insert);
        record.editing = true;
        let accepted: boolean;
        try { accepted = await vscode.workspace.applyEdit(edit); } finally { record.editing = false; }
        return { ...this.state(record), accepted };
      }
      case 'undo': case 'redo':
        record.panel.reveal(undefined, false);
        await vscode.commands.executeCommand(command);
        return this.state(record);
      case 'save':
        if (document.isUntitled) { record.panel.reveal(); await vscode.commands.executeCommand('workbench.action.files.save'); }
        else if (!(await document.save())) throw new Error('保存未完成。');
        return this.state(record);
      case 'save_as': record.panel.reveal(); await vscode.commands.executeCommand('workbench.action.files.saveAs'); return null;
      case 'close': record.panel.reveal(); await vscode.commands.executeCommand('workbench.action.closeActiveEditor'); return null;
      case 'new': await this.newDocument(); return null;
      case 'open': {
        const picked = await vscode.window.showOpenDialog({ canSelectMany: false, filters: { Markdown: ['md', 'markdown', 'txt'] } });
        if (picked?.[0]) await vscode.commands.executeCommand('vscode.openWith', picked[0], viewType);
        return null;
      }
      case 'preserve_draft': {
        if (typeof args.text !== 'string') throw new Error('草稿内容无效。');
        const draft = await vscode.workspace.openTextDocument({ language: 'markdown', content: args.text });
        await vscode.window.showTextDocument(draft, { preview: false, preserveFocus: true });
        return null;
      }
      case 'read_settings': return this.context.globalState.get('mdre.settings', {});
      case 'write_settings': await this.context.globalState.update('mdre.settings', args.settings); return null;
      case 'clipboard_read': return vscode.env.clipboard.readText();
      case 'clipboard_write':
        if (typeof args.text !== 'string') throw new Error('剪贴板内容无效。');
        await vscode.env.clipboard.writeText(args.text); return null;
      case 'open_external':
        if (typeof args.url !== 'string' || !/^(https?:|mailto:)/i.test(args.url)) throw new Error('链接协议不受支持。');
        await vscode.env.openExternal(vscode.Uri.parse(args.url)); return null;
      case 'reveal_document': await vscode.commands.executeCommand('revealFileInOS', document.uri); return null;
      case 'open_settings_directory': await vscode.commands.executeCommand('workbench.action.openSettings', 'MDRE'); return 'VS Code 设置';
      case 'register_file_association': throw new Error('请通过 VS Code 的“重新打开编辑器方式”设置 Markdown 默认编辑器。');
      case 'pick_export': {
        if (!['html','pdf'].includes(args.format) || typeof args.suggested!=='string') throw new Error('导出格式无效。');
        const defaultUri=document.isUntitled ? undefined : vscode.Uri.joinPath(document.uri,'..',path.basename(args.suggested));
        const uri = await vscode.window.showSaveDialog({ defaultUri, filters: args.format==='pdf'?{PDF:['pdf']}:{HTML:['html']} });
        return uri?.fsPath ?? null;
      }
      case 'write_export':
        if (typeof args.path !== 'string' || !/\.html$/i.test(args.path) || typeof args.html !== 'string') throw new Error('HTML 导出参数无效。');
        await vscode.workspace.fs.writeFile(vscode.Uri.file(args.path), Buffer.from(args.html)); return null;
      case 'export_pdf': {
        if (typeof args.path!=='string' || !path.isAbsolute(args.path) || !/\.pdf$/i.test(args.path) || typeof args.html!=='string') throw new Error('PDF 导出参数无效。');
        const bytes=await vscode.window.withProgress({location:vscode.ProgressLocation.Notification,title:'MDRE：正在导出 PDF'},()=>pdfBytes(args.html,vscode.workspace.getConfiguration('mdre.pdf').get<string>('browserPath')));
        await vscode.workspace.fs.writeFile(vscode.Uri.file(args.path),bytes);
        return {path:args.path,bytes:bytes.length,engine:'Chromium / 系统浏览器'};
      }
      case 'clipboard_image_paths': return clipboardImagePaths();
      case 'pick_images': return (await vscode.window.showOpenDialog({ canSelectMany: true, title: '插入图片（引用原文件）', filters: { 图片: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'] } }))?.map(uri => uri.fsPath) ?? null;
      case 'read_binary': {
        const absolute = typeof args.path === 'string' ? absoluteImagePath(args.path) : null;
        if (!absolute) throw new Error('图片需要绝对文件路径。');
        return readImage(vscode.Uri.file(absolute));
      }
      case 'read_image': {
        if (typeof args.resourceRoot !== 'string' || typeof args.relative !== 'string') throw new Error('图片资源路径无效。');
        const name = args.relative.replace(/^assets\//, '');
        if (!name || /[\\/]/.test(name) || name === '..') throw new Error('恢复区图片只允许扁平文件名。');
        return readImage(vscode.Uri.joinPath(vscode.Uri.file(args.resourceRoot), name));
      }
      case 'read_document_image': {
        if (typeof args.relative !== 'string') throw new Error('图片路径无效。');
        // 前端已按 Markdown URI 解码一次，保留真实文件名中的百分号。
        const uri = vscode.Uri.joinPath(document.uri, '..', args.relative);
        return readImage(uri);
      }
      case 'save_image': {
        const request = args.request;
        if (!request || typeof request.base64 !== 'string' || !/^(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(request.extension)) throw new Error('图片数据无效。');
        const bytes = Buffer.from(request.base64, 'base64');
        const hash = createHash('sha256').update(bytes).digest('hex');
        if (!bytes.length || bytes.length > 20 * 1024 * 1024) throw new Error('图片为空或超过 20 MB。');
        const store = async (directory: vscode.Uri, fallback: boolean) => {
          const uri = vscode.Uri.joinPath(directory, `${hash}.${request.extension.toLowerCase()}`);
          await vscode.workspace.fs.createDirectory(directory);
          let deduplicated = false;
          try { const existing = await vscode.workspace.fs.readFile(uri); if (!Buffer.from(existing).equals(bytes)) throw new Error('图片名称冲突，原文件未覆盖。'); deduplicated = true; }
          catch (reason) { if (!(reason instanceof vscode.FileSystemError) || reason.code !== 'FileNotFound') throw reason; }
          if (!deduplicated) await vscode.workspace.fs.writeFile(uri, bytes);
          return { relativePath: fallback ? `assets/${path.basename(uri.fsPath)}` : '', absolutePath: uri.fsPath, resourceRoot: directory.fsPath, bytes: bytes.length, hash, deduplicated, fallback, referenceAbsolute: document.isUntitled };
        };
        try { return await store(vscode.Uri.joinPath(this.context.globalStorageUri, 'images'), false); }
        catch (primary) {
          const directory = document.isUntitled ? vscode.Uri.joinPath(this.context.globalStorageUri, 'recovery', String(request.docId), 'assets') : vscode.Uri.joinPath(document.uri, '..', 'assets');
          try { return await store(directory, true); } catch (fallback) { throw new Error(`持久图片目录写入失败：${primary}；assets 兜底失败：${fallback}`); }
        }
      }
      default: throw new Error(`插件版暂不支持此操作：${command}`);
    }
  }
}
