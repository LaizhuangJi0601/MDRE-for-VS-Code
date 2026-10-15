import * as vscode from 'vscode';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { MDREProvider } from '../extension/extension';

export async function run() {
  const root = path.resolve(__dirname, '../..');
  const folder = vscode.Uri.file(path.join(root, '.tmp/host'));
  // 独立文档避免复用上次测试窗口恢复的编辑器及撤销历史。
  const uri = vscode.Uri.joinPath(folder, `fixture-${Date.now()}.md`);
  await vscode.workspace.fs.writeFile(uri, Buffer.from('# 原文\r\n\r\n未改段落\r\n'));
  const document = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(document);
  const settings = new Map<string, unknown>();
  const context = { extensionUri: vscode.Uri.file(root), globalStorageUri: vscode.Uri.joinPath(folder, 'storage'), globalState: { get: (key: string, fallback: unknown) => settings.get(key) ?? fallback, update: async (key: string, value: unknown) => { settings.set(key, value); } } } as unknown as vscode.ExtensionContext;
  const provider = new MDREProvider(context);
  let receive: (message: unknown) => Promise<void>;
  const messages: any[] = [];
  const panel = { active: true, reveal() {}, onDidDispose() {}, webview: {
    options: {}, html: '', cspSource: 'vscode-webview:',
    asWebviewUri: (value: vscode.Uri) => value,
    onDidReceiveMessage: (callback: typeof receive) => { receive = callback; return { dispose() {} }; },
    postMessage: async (value: unknown) => { messages.push(value); return true; },
  } } as unknown as vscode.WebviewPanel;
  provider.resolveCustomTextEditor(document, panel);
  const subscriptions = [vscode.workspace.onDidChangeTextDocument(event => provider.changed(event.document)), vscode.workspace.onDidSaveTextDocument(doc => provider.saved(doc))];
  let serial = 0;
  async function rpc(command: string, args = {}) {
    const id = ++serial;
    await receive!({ type: 'rpc', id, command, args });
    const result = messages.find(message => message.type === 'rpc-result' && message.id === id);
    assert(result, '宿主应回复请求');
    if (result.error) throw new Error(result.error);
    return result.value;
  }
  const passed: string[] = [];
  try {
    const initial = await rpc('document');
    assert.equal(initial.text, '# 原文\r\n\r\n未改段落\r\n');
    const edited = await rpc('edit', { version: initial.version, from: 2, to: 4, insert: '修改标题' });
    assert.equal(edited.accepted, true);
    assert.equal(document.getText(), '# 修改标题\r\n\r\n未改段落\r\n');
    assert.equal(document.isDirty, true);
    passed.push('真实 TextDocument 最小补丁编辑，保留 CRLF 与未修改段落');
    const stale = await rpc('edit', { version: initial.version, from: 0, to: 0, insert: '过期修改' });
    assert.equal(stale.accepted, false);
    assert(!document.getText().includes('过期修改'));
    passed.push('过期版本拒绝写入');

    // 测试替身的 panel.reveal 不会真的获取焦点，先把原生撤销目标放回文档编辑器。
    await vscode.window.showTextDocument(document, { preserveFocus: false });
    await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
    assert.equal(vscode.window.activeTextEditor?.document.uri.toString(), uri.toString());
    await rpc('undo');
    assert.equal(document.getText(), initial.text);
    await rpc('redo');
    assert.equal(document.getText(), edited.text);
    passed.push('VS Code 原生撤销/重做');
    await rpc('save');
    assert.equal(document.isDirty, false);
    assert.equal(Buffer.from(await vscode.workspace.fs.readFile(uri)).toString(), edited.text);
    passed.push('真实 VS Code 保存与磁盘回读');

    const edit = new vscode.WorkspaceEdit();
    edit.insert(uri, new vscode.Position(3, 0), '外部修改\r\n');
    await vscode.workspace.applyEdit(edit);
    assert(messages.some(message => message.type === 'document' && message.document.text.includes('外部修改')));
    passed.push('外部 WorkspaceEdit 通知 Webview');
    provider.requestReload();
    assert(messages.some(message => message.type === 'reload'));
    await receive!({ type: 'reload-ready' });
    assert(panel.webview.html.includes('Content-Security-Policy'));
    assert(panel.webview.html.includes('preventDefaultContextMenuItems'));
    passed.push('开发刷新协议、资源地址与自定义右键设置');
    const pdfPath=path.join(root,'output/pdf/vscode-host.pdf');
    const pdf=await rpc('export_pdf',{path:pdfPath,html:readFileSync(path.join(root,'output/pdf/plugin-snapshot.html'),'utf8')});
    assert(pdf.bytes>1000);assert.equal(pdf.path,pdfPath);
    assert(readFileSync(pdfPath).subarray(0,5).equals(Buffer.from('%PDF-')));
    await assert.rejects(()=>rpc('export_pdf',{path:uri.fsPath,html:'test'}),/PDF 导出参数无效/);
    passed.push('真实 VS Code 宿主调用系统浏览器生成完整 PDF，拒绝无效输出格式');

    const imageUri = vscode.Uri.joinPath(folder, '原图 (1)#%.png');
    const imageBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jG1sAAAAASUVORK5CYII=', 'base64');
    await vscode.workspace.fs.writeFile(imageUri, imageBytes);
    assert.match(await rpc('read_binary', { path: imageUri.fsPath }), /^data:image\/png;base64,/);
    assert.match(await rpc('read_document_image', { relative: path.basename(imageUri.fsPath) }), /^data:image\/png;base64,/);
    const imageArgs = { request: { docId: 'image-test', base64: imageBytes.toString('base64'), extension: 'png' } };
    const storedImage = await rpc('save_image', imageArgs);
    assert.equal(storedImage.fallback, false);assert.equal(storedImage.relativePath, '');
    assert.ok(storedImage.absolutePath.includes(path.join('storage', 'images')));
    assert.equal((await rpc('save_image', imageArgs)).deduplicated, true);
    const unsavedDocument = await vscode.workspace.openTextDocument({ language: 'markdown', content: '未保存文档' });
    provider.resolveCustomTextEditor(unsavedDocument, panel);
    const unsavedImage = await rpc('save_image', imageArgs);assert.equal(unsavedImage.fallback, false);
    assert.match(await rpc('read_binary', { path: unsavedImage.absolutePath }), /^data:image\/png;base64,/);
    await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(folder, 'blocked-storage'), Buffer.from('阻挡目录'));
    const brokenContext = { ...context, globalStorageUri: vscode.Uri.joinPath(folder, 'blocked-storage') };
    const fallbackProvider = new MDREProvider(brokenContext);fallbackProvider.resolveCustomTextEditor(document, panel);
    const fallbackImage = await rpc('save_image', imageArgs);assert.equal(fallbackImage.fallback, true);assert.ok(fallbackImage.relativePath.startsWith('assets/'));
    assert.match(await rpc('read_document_image', { relative: fallbackImage.relativePath }), /^data:image\/png;base64,/);
    passed.push('绝对和相对路径读取、持久图片去重、未保存文档插图、assets 失败兜底');

    const manifest = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
    const extension = vscode.extensions.getExtension(`${manifest.publisher}.${manifest.name}`);
    assert(extension, '开发路径加载插件');
    await extension.activate();
    await vscode.commands.executeCommand('mdre.open', uri);
    assert(vscode.window.tabGroups.all.some(group => group.tabs.some(tab => tab.input instanceof vscode.TabInputCustom && tab.input.viewType === 'mdre.editor')));
    passed.push('实际扩展激活，Markdown 可通过命令打开自定义编辑器');
    mkdirSync(path.join(root, '.tmp/host'), { recursive: true });
    writeFileSync(path.join(root, '.tmp/host/results.json'), JSON.stringify({ passed }, null, 2));
    console.log(JSON.stringify({ passed }, null, 2));
  } finally { for (const disposable of subscriptions) disposable.dispose(); }
}
