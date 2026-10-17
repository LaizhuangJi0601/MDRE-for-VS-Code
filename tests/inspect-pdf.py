from pathlib import Path
import json
import fitz

root = Path(__file__).resolve().parents[1] / 'output' / 'pdf'
reports = []
for name in ['plugin.pdf', 'vscode-host.pdf', 'desktop.pdf']:
    doc = fitz.open(root / name)
    for stale in root.glob(f'{Path(name).stem}-page-*.png'):
        if int(stale.stem.rsplit('-', 1)[1]) > len(doc) and stale.resolve().parent == root.resolve():
            stale.unlink()
    pages = []
    full = '\n'.join(page.get_text() for page in doc)
    assert 'CODE_END_SENTINEL' in full and 'PDF_END_SENTINEL' in full, name
    assert 'Python' in full and 'JavaScript' in full and 'unknown-test-language' in full, name
    colors = set()
    fonts = set()
    for index, page in enumerate(doc):
        page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False).save(root / f'{Path(name).stem}-page-{index+1}.png')
        spans = [span for block in page.get_text('dict')['blocks'] if 'lines' in block for line in block['lines'] for span in line['spans']]
        outside = [span['text'] for span in spans if min(span['bbox'][:2]) < -1 or span['bbox'][2] > page.rect.width+1 or span['bbox'][3] > page.rect.height+1]
        assert not outside, (name, index, outside)
        colors.update(span['color'] for span in spans)
        fonts.update(font[3] for font in page.get_fonts())
        pages.append({'page': index+1, 'size': list(page.rect)[2:], 'outside': outside})
    assert 0xff7b72 in colors and 0xb42363 in colors, (name, colors)
    assert any('KaTeX_Math' in font for font in fonts), (name, fonts)
    assert any('KaTeX_Size' in font for font in fonts), (name, fonts)
    reports.append({'file': name, 'pageCount': len(doc), 'pages': pages, 'fonts': sorted(fonts), 'colors': [f'#{color:06x}' for color in sorted(colors)]})
(root / 'pdf-inspection.json').write_text(json.dumps(reports, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(reports, ensure_ascii=False, indent=2))
