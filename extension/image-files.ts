import * as vscode from 'vscode';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export async function readImage(uri: vscode.Uri): Promise<string> {
  const stat = await vscode.workspace.fs.stat(uri);
  if (!(stat.type & vscode.FileType.File) || stat.size > 32 * 1024 * 1024) throw new Error('图片不存在或超过 32 MB。');
  const extension = path.extname(uri.path).slice(1).toLowerCase();
  const mime = ({ svg: 'svg+xml', jpg: 'jpeg' } as Record<string, string>)[extension] ?? extension;
  if (!['svg+xml', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(mime)) throw new Error('图片格式不受支持。');
  const bytes = await vscode.workspace.fs.readFile(uri);
  return `data:image/${mime};base64,${Buffer.from(bytes).toString('base64')}`;
}

export async function clipboardImagePaths(): Promise<string[]> {
  if (process.platform !== 'win32') return [];
  // 只读取 Windows 文件剪贴板，优先 PowerShell 7；无 PS7 的机器使用系统自带宿主。
  const ps7 = path.join(process.env.ProgramFiles ?? 'C:/Program Files', 'PowerShell/7/pwsh.exe');
  const executable = existsSync(ps7) ? ps7 : path.join(process.env.SystemRoot ?? 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
  const code = String.raw`
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -TypeDefinition @'
using System; using System.Text; using System.Collections.Generic; using System.Runtime.InteropServices;
public static class MdreImageClipboard {
  [DllImport("user32.dll")] static extern bool OpenClipboard(IntPtr owner);
  [DllImport("user32.dll")] static extern bool CloseClipboard();
  [DllImport("user32.dll")] static extern IntPtr GetClipboardData(uint format);
  [DllImport("shell32.dll", CharSet=CharSet.Unicode)] static extern uint DragQueryFile(IntPtr drop, uint index, StringBuilder name, uint size);
  public static string[] Paths() {
    var result=new List<string>(); if(!OpenClipboard(IntPtr.Zero)) return result.ToArray();
    try { var drop=GetClipboardData(15); if(drop==IntPtr.Zero) return result.ToArray();
      var count=DragQueryFile(drop,UInt32.MaxValue,null,0);
      for(uint index=0;index<count;index++){var name=new StringBuilder((int)DragQueryFile(drop,index,null,0)+1);DragQueryFile(drop,index,name,(uint)name.Capacity);result.Add(name.ToString());}
      return result.ToArray();
    } finally {CloseClipboard();}
  }
}
'@
ConvertTo-Json -InputObject @([MdreImageClipboard]::Paths()) -Compress`;
  try {
    const result = await promisify(execFile)(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', code], { windowsHide: true, timeout: 5000, encoding: 'utf8' });
    const values: unknown = JSON.parse(result.stdout.trim());
    return Array.isArray(values) ? values.filter((value): value is string => typeof value === 'string' && /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(value)) : [];
  } catch { return []; }
}
