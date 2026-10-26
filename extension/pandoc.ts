import { execFile } from 'node:child_process';
import { access, mkdtemp, readFile, writeFile, rm, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// 转换进程按需启动，参数逐项传递，不经过 shell；检测和转换都有超时。
const execute = (exe: string, args: string[], cwd?: string, timeout=90_000): Promise<{stdout:string;warnings:string}> => new Promise((resolve,reject) => {
  execFile(exe,args,{cwd,timeout,windowsHide:true,maxBuffer:8*1024*1024,encoding:'utf8'},(error,stdout,stderr) => {
    if(error) reject(new Error(`Pandoc 执行失败：${stderr || error.message}`));
    else resolve({stdout,warnings:stderr});
  });
});
export async function detectPandoc(configured: string) {
  const name = process.platform === 'win32' ? 'pandoc.exe' : 'pandoc';
  const value = configured.trim().replace(/^"|"$/g,'');
  if(value && (!path.isAbsolute(value) || !['pandoc.exe','pandoc'].includes(path.basename(value).toLowerCase()))) throw new Error('请填写完整的 pandoc.exe（其他系统为 pandoc）绝对路径，不能只填写文件夹。');
  const env = process.env;
  const candidates = value ? [value] : [...(env.PATH ?? '').split(path.delimiter).map(p=>path.join(p,name)),
    ...[[env.LOCALAPPDATA,'Pandoc'],[env.LOCALAPPDATA,'Programs/Pandoc'],[env.ProgramFiles,'Pandoc'],[env.CONDA_PREFIX,'Scripts'],[env.USERPROFILE,'scoop/apps/pandoc/current'],[env.USERPROFILE,'anaconda3/Scripts']].filter(([root])=>root).map(([root,sub])=>path.join(root!,sub!,name))];
  let failure='';
  for(const candidate of [...new Set(candidates)]) try { await access(candidate); const result=await execute(candidate,['--version'],undefined,5000); if(result.stdout.startsWith('pandoc')) return {path:candidate,version:result.stdout.split(/\r?\n/)[0]}; } catch(error) {failure=String(error);}
  throw new Error(`未找到可用 Pandoc，请在设置中填写到 ${name} 的完整路径。${value ? failure : ''}`);
}
function absolute(value: unknown, extension: string): string {
  if(typeof value !== 'string' || !path.isAbsolute(value) || path.extname(value).toLowerCase()!==extension) throw new Error(`需要绝对 ${extension} 文件路径。`);
  return value;
}
export async function convertWord(args: {direction:string;tool:string;path:string;html?:string;input?:string;reference?:string}) {
  const tool=await detectPandoc(args.tool);
  const temp=await mkdtemp(path.join(tmpdir(),'mdre-word-'));
  let assets: string|undefined;
  try {
    const exporting=args.direction==='export';
    if(!exporting && args.direction!=='import') throw new Error('转换方向无效。');
    const output=absolute(args.path,exporting?'.docx':'.md');
    const command: string[]=[];
    if(exporting) {
      if(typeof args.html!=='string' || Buffer.byteLength(args.html)>128*1024*1024) throw new Error('导出内容无效或超过 128 MiB。');
      const input=path.join(temp,'input.html'); await writeFile(input,args.html);
      command.push(input,'--from=html','--to=docx');
      if(args.reference?.trim()) {const reference=absolute(args.reference,'.docx');await access(reference);command.push(`--reference-doc=${reference}`);}
    } else {
      const input=absolute(args.input,'.docx');
      let exists=false;try{await access(output);exists=true;}catch{}
      if(exists) throw new Error('导入请使用新的 Markdown 文件名，避免覆盖已有文件。');
      assets=path.join(path.dirname(output),`${path.basename(output,'.md')}.assets-${Date.now()}-${Math.random().toString(16).slice(2)}`);
      command.push(input,'--from=docx','--to=gfm+tex_math_dollars','--wrap=none',`--extract-media=${path.basename(assets)}`);
    }
    const staged=path.join(temp,exporting?'result.docx':'result.md');
    command.push('--output',staged);
    const result=await execute(tool.path,command,path.dirname(output));
    const bytes=await readFile(staged);
    if(exporting) {
      if(bytes[0]!==0x50 || bytes[1]!==0x4b) throw new Error('Pandoc 未生成有效 DOCX。');
      const pending=`${output}.${Date.now()}.pending`;
      try{await writeFile(pending,bytes,{flag:'wx'});await rename(pending,output);}finally{await rm(pending,{force:true});}
    } else await writeFile(output,bytes,{flag:'wx'});
    assets=undefined;
    return {path:output,bytes:bytes.length,warnings:result.warnings};
  } finally {
    if(assets) await rm(assets,{recursive:true,force:true});
    await rm(temp,{recursive:true,force:true});
  }
}
