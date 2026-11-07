from pathlib import Path
from html import escape
import re
root=Path(__file__).resolve().parents[1]
source=(root/'docs/PROJECTION-MANUAL.md').read_text()
(root/'public/SOMA-PROJECTION-MANUAL.md').write_text(source)
(root/'public/SOMA-PROJECTION-ENGINE.md').write_text((root/'docs/PROJECTION-ENGINE.md').read_text())
def inline(text):
    text=escape(text)
    def link(match):
        raw=match.group(0);url=raw.rstrip('.,;!')
        return f'<a href="{url}" rel="noreferrer">{url}</a>'+raw[len(url):]
    text=re.sub(r'https?://[^\s<>]+',link,text)
    return re.sub(r'\*\*(.*?)\*\*',r'<strong>\1</strong>',text)
parts=[];nav=[];listing=None;table=False;code=False
for line in source.splitlines():
    if line.startswith('```'):
        parts.append('</code></pre>' if code else '<pre><code>');code=not code;continue
    if code:parts.append(escape(line)+'\n');continue
    if not line:
        if listing:parts.append(f'</{listing}>');listing=None
        if table:parts.append('</tbody></table></div>');table=False
        continue
    if line.startswith('# '):continue
    if line.startswith('## '):
        title=line[3:];ident=re.sub(r'[^a-z0-9]+','-',title.lower()).strip('-');nav.append(f'<a href="#{ident}">{escape(title)}</a>');parts.append(f'<h2 id="{ident}">{escape(title)}</h2>')
    elif line.startswith('|'):
        cells=[s.strip() for s in line.strip('|').split('|')]
        if all(re.fullmatch('[-: ]+',c) for c in cells):continue
        if not table:parts.append('<div class="table-wrap"><table><thead><tr>'+''.join('<th>'+inline(c)+'</th>' for c in cells)+'</tr></thead><tbody>');table=True
        else:parts.append('<tr>'+''.join('<td>'+inline(c)+'</td>' for c in cells)+'</tr>')
    elif re.match(r'^\d+\. |^- ',line):
        kind='ul' if line.startswith('- ') else 'ol'
        if listing!=kind:
            if listing:parts.append(f'</{listing}>')
            parts.append(f'<{kind}>');listing=kind
        parts.append('<li>'+inline(re.sub(r'^\d+\. |^- ','',line))+'</li>')
    else:parts.append('<p>'+inline(line)+'</p>')
base=(root/'public/soma-manual.html').read_text();css=re.search(r'<style>(.*?)</style>',base,re.S).group(1)+'pre{background:#0b100b;padding:20px;overflow:auto;border:1px solid #39452f;border-radius:6px;font-size:13px}code{font-family:monospace}main a{overflow-wrap:anywhere}'
html='<!doctype html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SOMA / Projection — Panduan Studio 12</title><style>'+css+'</style></head><body><header><small>SOMA / PROJECTION · STUDIO 12</small><h1>Tubuh di kamera.<br>Cahaya di layar.</h1><p>Panduan Organic Body, cue, kalibrasi empat titik, dan sambungan Mac–proyektor.</p><a href="/">Buka SOMA</a><a href="/SOMA-PROJECTION-MANUAL.md" download>Unduh panduan</a><a href="/SOMA-PROJECTION-ENGINE.md" download>Catatan teknis &amp; pengujian</a><button onclick="window.print()">Cetak / simpan PDF</button></header><div class="layout"><nav aria-label="Daftar isi">'+''.join(nav)+'</nav><main>'+''.join(parts)+'</main></div><footer>Sprint 3 · Uji kamera dan proyektor fisik masih diperlukan.</footer></body></html>'
(root/'public/projection-manual.html').write_text(html)
