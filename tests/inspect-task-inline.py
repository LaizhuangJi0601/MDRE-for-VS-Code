# 用途：inspect-task-inline 的插件宿主／界面验证。
from pathlib import Path
import fitz

root = Path(__file__).resolve().parents[1] / 'output' / 'pdf'
doc = fitz.open(root / 'task-inline.pdf')
assert len(doc) == 1
text = doc[0].get_text()
assert '[ ] 这是任务清单' not in text and '[ ] 任务1' not in text
assert '任务2（已完成）' in text and 'value = 42' in text
doc[0].get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False).save(root / 'task-inline-page-1.png')
print('PASS: 单页 PDF 任务前缀已移除，内容完整，检查图已生成')
