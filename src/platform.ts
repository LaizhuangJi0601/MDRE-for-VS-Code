import { difference } from './edits';

type VSCodeApi = { postMessage(message: unknown): void; getState(): unknown; setState(state: unknown): void };
declare const acquireVsCodeApi: () => VSCodeApi;
const api = acquireVsCodeApi();
let serial = 0;
const requests = new Map<number, { resolve(value: any): void; reject(reason: Error): void }>();
export type HostDocument = { text: string; version: number; path: string | null; title: string; dirty: boolean; savedText: string };
let confirmed: HostDocument;
let desired = '';
let queue: Promise<void> = Promise.resolve();
let generation = 0;
let pending = 0;
let failure: Error | null = null;
let update: (document: HostDocument) => void = () => {};
let warn: (reason: unknown) => void = () => {};
let beforeReload: () => boolean = () => true;

export function invoke<T = unknown>(command: string, args: Record<string, unknown> = {}): Promise<T> {
  const id = ++serial;
  return new Promise((resolve, reject) => {
    requests.set(id, { resolve, reject });
    api.postMessage({ type: 'rpc', id, command, args });
  });
}
// 每次界面编辑串行提交最小文本补丁；版本由宿主确认，源码和富文本共用 VS Code 撤销历史。
export function submitSource(text: string) {
  desired = text;
  const epoch = generation;
  pending++;
  api.setState({ draft: text, version: confirmed.version });
  queue = queue.then(async () => {
    if (epoch !== generation) return;
    const edit = difference(confirmed.text, text);
    if (!edit.insert && edit.from === edit.to) return;
    const response = await invoke<HostDocument & { accepted: boolean }>('edit', { version: confirmed.version, ...edit });
    if (epoch !== generation) return;
    if (!response.accepted) {
      await preserve(desired);
      desired = response.text;
      generation++;
      confirmed = response;
      update(response);
      throw new Error('文档已在其他编辑器修改；已同步最新内容，并将本地修改保留为新草稿。');
    }
    confirmed = response;
  }).catch(reason => { failure = reason instanceof Error ? reason : new Error(String(reason)); warn(failure); })
    .finally(() => { pending--; });
}
async function preserve(text: string) {
  api.setState({ draft: text, version: confirmed.version });
  await invoke('preserve_draft', { text });
}
export async function flush() {
  await queue;
  if (failure) { const reason = failure; failure = null; throw reason; }
}
// 撤销、重做及保存的 RPC 回执同样是宿主确认，不能只更新界面而保留旧提交版本。
export function acceptDocument(state: HostDocument) {
  if (confirmed && state.version < confirmed.version) return;
  confirmed = state;
  desired = state.text;
  update(state);
  api.setState({ draft: state.text, version: state.version });
}
export async function connect(onUpdate: typeof update, onError: typeof warn, canReload: typeof beforeReload) {
  update = onUpdate; warn = onError; beforeReload = canReload;
  confirmed = await invoke<HostDocument>('document');
  desired = confirmed.text;
  update(confirmed);
  const state = api.getState() as { draft?: string } | undefined;
  if (state?.draft !== undefined && state.draft !== confirmed.text) {
    await preserve(state.draft);
    warn('上次未提交的内容已保留为新草稿。');
  }
  api.setState({ draft: confirmed.text, version: confirmed.version });
}
window.addEventListener('message', event => {
  const message = event.data;
  if (message.type === 'rpc-result') {
    const request = requests.get(message.id);
    if (!request) return;
    requests.delete(message.id);
    if (message.error) request.reject(new Error(message.error)); else request.resolve(message.value);
  } else if (message.type === 'document' && confirmed) {
    const next = message.document as HostDocument;
    if (next.version <= confirmed.version && next.text !== confirmed.text) return;
    if (next.text === desired) {
      confirmed = next;
      // 保存、另存为的元数据更新不能重置光标和编辑选区。
      update(next);
      return;
    }
    if (pending) {
      const draft = desired;
      generation++;
      desired = next.text;
      confirmed = next;
      void preserve(draft).then(() => warn('文档发生外部修改；本地未提交内容已保留为新草稿。')).catch(warn);
    } else { confirmed = next; desired = next.text; }
    update(next);
    api.setState({ draft: desired, version: confirmed.version });
  } else if (message.type === 'reload') {
    const reload = async () => {
      if (!beforeReload()) { setTimeout(() => void reload(), 150); return; }
      try { await flush(); api.postMessage({ type: 'reload-ready' }); } catch (reason) { warn(reason); }
    };
    void reload();
  } else if (message.type === 'command') {
    document.dispatchEvent(new CustomEvent('mdre:command', { detail: message.command }));
  }
});
