import test from 'node:test';
import assert from 'node:assert/strict';
import { Transform } from 'prosemirror-transform';
import { DocumentSession } from '../src/session';
import { parse, semantics } from '../src/model';
import { convertBlock, deleteBlock } from '../src/blocks';
import { renderedEdit, type Patch } from '../src/edits';

const cases = [
  '', '正文', '正文\n', '正文\r\n', '\uFEFF正文',
  '正文\n\n尾段\n', '正文\r\n\r\n尾段\r\n', '\uFEFF正文\r\n\r\n尾段\r\n',
  '前文\n\n正文\n\n尾段\n', '前文\n\n正文\n',
  '正文\n\n\n\n尾段\n',
];
function commit(doc: DocumentSession, edit: Patch) { doc.commit(doc.ticket('test'), edit); }
function create(source: string) {
  const doc = new DocumentSession('code-paragraph', source);
  const target = doc.model.blocks.find(block => block.type === 'paragraph' && block.node.textContent === '正文') ?? doc.model.blocks[0];
  commit(doc, convertBlock(doc.model, target.id, 'code', { info: 'typescript', followingParagraph: true }));
  return doc;
}
function code(doc: DocumentSession) { return doc.model.blocks.find(block => block.node.attrs.kind === 'code')!; }
function following(doc: DocumentSession) {
  const position = code(doc).pos;
  return doc.model.blocks.filter(block => block.parent === null && block.pos > position).sort((a,b) => a.pos-b.pos)[0];
}
function check(doc: DocumentSession) {
  assert.deepEqual(semantics(parse(doc.source).doc), semantics(doc.model.doc));
  if(doc.originalText.includes('\r\n')) assert(!doc.source.replace(/\r\n/g,'').includes('\n'),'CRLF 不应被切半或改成混合换行');
  if(doc.originalText.startsWith('\uFEFF')) assert(doc.source.startsWith('\uFEFF'),'保留 BOM');
}

for (const source of cases) {
  test(`代码块可直接删除，保留独立空段及相邻内容：${JSON.stringify(source)}`, () => {
    const doc = create(source), before = doc.source;
    assert.equal(following(doc).type, 'paragraph'); assert.equal(following(doc).node.content.size, 0);
    const target = code(doc);
    const expected = new Transform(doc.model.doc).delete(target.pos,target.pos+target.node.nodeSize).doc;
    commit(doc, deleteBlock(doc.model,target.id));
    assert.deepEqual(semantics(doc.model.doc),semantics(expected));
    assert(!doc.model.blocks.some(block=>block.node.attrs.kind==='code')); check(doc);
    doc.undo(); assert.equal(doc.source,before);
    doc.redo(); check(doc);
  });

  test(`代码块删除后新增段落可逐字删空并重新输入：${JSON.stringify(source)}`, () => {
    const doc=create(source), paragraph=following(doc);
    const write=renderedEdit(doc.model,new Transform(doc.model.doc).insert(paragraph.pos+1,doc.model.doc.type.schema.text('新增段落')).doc);
    doc.commit(doc.ticket('test'),write.edit,undefined,write.model);
    commit(doc,deleteBlock(doc.model,code(doc).id));
    for(let remaining=4;remaining>0;remaining--) {
      const target=doc.model.blocks.find(block=>block.type==='paragraph'&&block.node.textContent==='新增段落'.slice(0,remaining))!;
      assert(target,`应保留 ${remaining} 字的独立段落`);
      const expected=new Transform(doc.model.doc).delete(target.pos+target.node.nodeSize-2,target.pos+target.node.nodeSize-1).doc;
      const result=renderedEdit(doc.model,expected);
      doc.commit(doc.ticket('test'),result.edit,undefined,result.model);
      assert.deepEqual(semantics(doc.model.doc),semantics(expected)); check(doc);
    }
    const empty=doc.model.blocks.filter(block=>block.type==='paragraph'&&!block.node.content.size).sort((a,b)=>a.pos-b.pos)[0];
    assert(empty);
    const result=renderedEdit(doc.model,new Transform(doc.model.doc).insert(empty.pos+1,doc.model.doc.type.schema.text('重新输入')).doc);
    doc.commit(doc.ticket('test'),result.edit,undefined,result.model);
    assert(doc.model.blocks.some(block=>block.node.textContent==='重新输入')); check(doc);
  });
}
