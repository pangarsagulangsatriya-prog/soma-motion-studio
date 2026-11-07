from pathlib import Path
from html import escape
import re
root=Path(__file__).resolve().parents[1]
source=(root/'docs/USER-MANUAL.md').read_text()
(root/'public/SOMA-USER-MANUAL.md').write_text(source)
ids={'Mulai cepat':'mulai','Potret lewat gestur':'foto','Empat foto di kiri kanvas':'kotak','Ganti, hapus, dan unduh':'kelola','Pengaturan arsip foto':'pengaturan','Teks, foto sumber, dan visual':'visual','Studio, Clean, dan fullscreen':'layar','Suara dan rekaman':'audio','Saat sesuatu belum bekerja':'bantuan','Latihan sebelum pertunjukan':'latihan'}
def inline(t):return re.sub(r'\*\*(.*?)\*\*',r'<strong>\1</strong>',escape(t))
parts=[];nav=[];listing=None;table=False
for line in source.splitlines():
 if not line:
  if listing:parts.append(f'</{listing}>');listing=None
  if table:parts.append('</tbody></table></div>');table=False
  continue
 if line.startswith('# '):continue
 if line.startswith('## '):
  title=line[3:];ident=ids[title];nav.append(f'<a href="#{ident}">{escape(title)}</a>');parts.append(f'<h2 id="{ident}">{escape(title)}</h2>')
 elif line.startswith('|'):
  cells=[v.strip() for v in line.strip('|').split('|')]
  if all(re.fullmatch('[-: ]+',v) for v in cells):continue
  if not table:parts.append('<div class="table-wrap"><table><thead><tr>'+''.join(f'<th>{inline(v)}</th>' for v in cells)+'</tr></thead><tbody>');table=True
  else:parts.append('<tr>'+''.join(f'<td>{inline(v)}</td>' for v in cells)+'</tr>')
 elif re.match(r'^\d+\. |^- ',line):
  kind='ul' if line.startswith('- ') else 'ol'
  if listing!=kind:
   if listing:parts.append(f'</{listing}>')
   parts.append(f'<{kind}>');listing=kind
  parts.append('<li>'+inline(re.sub(r'^\d+\. |^- ','',line))+'</li>')
 else:parts.append('<p>'+inline(line)+'</p>')
css='''*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:25px}body{margin:0;background:#111713;color:#e0e7da;font:16px/1.75 system-ui,sans-serif}header{padding:55px max(24px,6vw);border-bottom:1px solid #39452f}header small{font:12px monospace;letter-spacing:3px;color:#cedf89}h1{font-size:clamp(30px,5vw,58px);font-weight:500;line-height:1.15;max-width:850px;margin:20px 0}header p{color:#a6b29b;max-width:680px}a{color:#d4e6a6}header a,header button{display:inline-block;padding:10px 16px;border:1px solid #566448;border-radius:5px;margin:8px 8px 0 0;background:none;color:#d4e6a6;font:inherit;text-decoration:none;cursor:pointer}.layout{display:grid;grid-template-columns:260px minmax(0,820px);gap:50px;max-width:1200px;margin:auto;padding:38px 24px 90px}nav{position:sticky;top:24px;align-self:start}nav a{display:block;padding:8px 12px;font-size:13px;text-decoration:none;border-left:1px solid #3c4933}nav a:hover{background:#263220}h2{font-size:27px;line-height:1.3;font-weight:500;color:#d6e7aa;margin:50px 0 18px}h2:first-of-type{margin-top:24px}p{color:#bbc6b1}li{padding:5px 0}strong{color:#edf4e3}.table-wrap{overflow:auto}table{border-collapse:collapse;width:100%;font-size:14px}td,th{border-bottom:1px solid #3b4732;padding:12px;text-align:left;vertical-align:top}th{color:#d5e4b3;background:#202a1d}footer{padding:24px;text-align:center;border-top:1px solid #39452f;font-size:12px;color:#899a7b}@media(max-width:760px){.layout{display:block}nav{position:static;display:flex;flex-wrap:wrap;gap:5px;margin-bottom:28px}nav a{border:1px solid #3c4933;border-radius:4px;font-size:12px}h2{font-size:24px}}@media print{body{background:white;color:#111;font-size:11pt}header{padding:0 0 20px}header a,header button,nav,footer{display:none}.layout{display:block;padding:0;max-width:none}h1{font-size:28pt}h2{break-after:avoid;color:#222;font-size:18pt}p,li,strong,td,th{color:#111}table{font-size:10pt}tr{break-inside:avoid}th{background:#eee}a{color:#111;text-decoration:none}}'''
html='<!doctype html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Panduan Pengguna · SOMA Studio 09</title><meta name="description" content="Cara memanggil kamera dengan suara, mengatur bingkai lewat tangan, memotret dengan pukulan, dan memainkan SOMA."><style>'+css+'</style></head><body><header><small>SOMA / STUDIO 09</small><h1>Panggil kamera.<br>Bentuk. Pukul. Jepret.</h1><p>Panduan pengguna untuk suara, teks bergerak, dan arsip foto di panggung.</p><a href="/">Buka SOMA</a><a href="/SOMA-USER-MANUAL.md" download>Unduh panduan Markdown</a><button onclick="window.print()">Cetak / simpan PDF</button></header><div class="layout"><nav aria-label="Daftar isi">'+''.join(nav)+'</nav><main>'+''.join(parts)+'</main></div><footer>SOMA Studio 09 · Foto dan video diproses di perangkatmu.</footer></body></html>'
(root/'public/soma-manual.html').write_text(html)
