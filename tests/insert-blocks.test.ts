import test from 'node:test';
import assert from 'node:assert/strict';
import { Transform } from 'prosemirror-transform';
import { DocumentSession } from '../src/session';
import { convertBlock, deleteBlock, withFollowingParagraph, type BlockKind } from '../src/blocks';
import { insertTable } from '../src/tables';
import { renderedEdit } from '../src/edits';
import { parse, semantics } from '../src/model';

for(const source of ['', '正文','正文\n第二行','正文\n\n后文\n','\uFEFF正文\r\n\r\n后文\r\n','- 前项\n\n\n\n后文\n','1. 前项\n\n\n\n后文\n','+ 前项\n\n\n\n后文\n','1) 前项\n\n\n\n后文\n','- 前项\n\n后文\n','1. 前项\n\n后文\n','# 标题 {#id}\n','- 前项\n\n# 标题 {#id}\n']) {
  for(const kind of ['bullet','ordered','task','quote','code','hr'] as BlockKind[]) test(`${kind} 插入与独立后续段落：${JSON.stringify(source)}`,()=>{
    const doc=new DocumentSession('insert-block',source);
    const target=doc.model.blocks.filter(b=>b.parent===null&&b.node.isTextblock).sort((a,b)=>a.pos-b.pos)[0];
    const edit=convertBlock(doc.model,target.id,kind,{followingParagraph:true});
    doc.commit(doc.ticket('test'),edit);
    const position=kind==='hr'&&target.node.content.size ? target.pos+target.node.nodeSize : target.pos;
    const roots=doc.model.blocks.filter(b=>b.parent===null).sort((a,b)=>a.pos-b.pos);
    const inserted=roots.find(b=>b.pos===position)!;
    const following=roots[roots.indexOf(inserted)+1];
    assert(inserted);assert.equal(following.type,'paragraph');assert.equal(following.node.content.size,0);
    const removeEmpty=new DocumentSession('remove-empty',doc.source);
    const removable=removeEmpty.model.blocks.find(b=>b.parent===null&&b.pos===position)!;
    const expectedRemoval=new Transform(removeEmpty.model.doc).delete(removable.pos,removable.pos+removable.node.nodeSize).doc;
    removeEmpty.commit(removeEmpty.ticket('test'),deleteBlock(removeEmpty.model,removable.id));
    assert.deepEqual(semantics(removeEmpty.model.doc),semantics(expectedRemoval),'直接删除新块仍保留独立空段');
    assert.deepEqual(withFollowingParagraph(doc.model,{from:0,to:0,insert:''},inserted.pos),{from:0,to:0,insert:''},'已有空段不重复添加');
    assert.equal(doc.historySize,1);const result=doc.source;
    doc.undo();assert.equal(doc.source,source);doc.redo();assert.equal(doc.source,result);
    const write=renderedEdit(doc.model,new Transform(doc.model.doc).insert(following.pos+1,doc.model.doc.type.schema.text('独立段落')).doc);
    doc.commit(doc.ticket('test'),write.edit,undefined,write.model);
    doc.commit(doc.ticket('test'),deleteBlock(doc.model,doc.model.blocks.find(b=>b.parent===null&&b.pos===inserted.pos)!.id));
    assert(doc.model.blocks.some(b=>b.type==='paragraph'&&b.node.textContent==='独立段落'));
    for(let remaining=4;remaining>0;remaining--) {
      const text='独立段落'.slice(0,remaining);
      const paragraph=doc.model.blocks.find(b=>b.parent===null&&b.type==='paragraph'&&b.node.textContent===text)!;
      const result=renderedEdit(doc.model,new Transform(doc.model.doc).delete(paragraph.pos+remaining,paragraph.pos+remaining+1).doc);
      doc.commit(doc.ticket('test'),result.edit,undefined,result.model);
    }
    assert.deepEqual(semantics(parse(doc.source).doc),semantics(doc.model.doc));
    if(source.startsWith('\uFEFF'))assert(doc.source.startsWith('\uFEFF'));
  });
  test(`表格插入与后续段落：${JSON.stringify(source)}`,()=>{
    const doc=new DocumentSession('table',source);
    const target=doc.model.blocks.filter(b=>b.parent===null&&b.node.isTextblock).sort((a,b)=>a.pos-b.pos)[0];
    doc.commit(doc.ticket('test'),insertTable(doc.model,target,2,2,true));
    const roots=doc.model.blocks.filter(b=>b.parent===null).sort((a,b)=>a.pos-b.pos);
    const table=roots.find(b=>b.type==='table')!;
    assert.equal(roots[roots.indexOf(table)+1].type,'paragraph');assert.equal(roots[roots.indexOf(table)+1].node.content.size,0);
    doc.undo();assert.equal(doc.source,source);
  });
}
