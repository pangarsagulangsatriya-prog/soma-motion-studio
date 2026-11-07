"""Package the local rehearsal build after npm run build; no publication."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib
import json
import shutil

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'releases'
OUT.mkdir(exist_ok=True)

def source_files():
    top = ['.gitignore', 'LICENSE', 'README.md', 'package.json', 'package-lock.json',
           'index.html', 'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json',
           'vite.config.ts']
    for name in top:
        path = ROOT / name
        if path.is_file():
            yield path
    for folder in ['src', 'tests', 'docs', 'scripts', 'public']:
        for path in sorted((ROOT / folder).rglob('*')):
            if not path.is_file() or path.is_symlink():
                continue
            rel = path.relative_to(ROOT)
            if '__pycache__' in rel.parts or path.suffix in ['.pyc', '.tsbuildinfo']:
                continue
            if folder == 'public' and (rel.parts[1] in ['models', 'wasm'] or path.name == 'soma-source.zip'):
                continue
            yield path

source = OUT / 'SOMA-Archive-source.zip'
with ZipFile(source, 'w', ZIP_DEFLATED, compresslevel=6) as archive:
    for path in source_files():
        archive.write(path, Path('SOMA-Archive-source') / path.relative_to(ROOT))
    archive.write(ROOT / 'docs/archive/MULAI.md', 'SOMA-Archive-source/MULAI.md')
    # Include the pinned Hydra source and license alongside SOMA's source offer.
    hydra = ROOT / 'node_modules/hydra-synth'
    for path in sorted(hydra.rglob('*')):
        rel = path.relative_to(hydra)
        if path.is_file() and (rel.parts[0] == 'src' or str(rel) in ['LICENSE', 'README.md', 'package.json']):
            archive.write(path, Path('SOMA-Archive-source/vendor/hydra-synth-1.4.0') / rel)

# Keep the existing in-app code download consistent with this local build.
shutil.copyfile(source, ROOT / 'public/soma-source.zip')
if (ROOT / 'dist').is_dir():
    shutil.copyfile(source, ROOT / 'dist/soma-source.zip')

build = OUT / 'SOMA-Archive-rehearsal-build.zip'
required = ['index.html', 'models/hand_landmarker.task', 'models/pose_landmarker_lite.task',
            'models/face_landmarker.task', 'wasm/vision_wasm_internal.wasm']
for name in required:
    assert (ROOT / 'dist' / name).is_file(), f'Build belum lengkap: {name}'
with ZipFile(build, 'w', ZIP_DEFLATED, compresslevel=6) as archive:
    for path in sorted((ROOT / 'dist').rglob('*')):
        if path.is_file():
            archive.write(path, Path('SOMA-Archive-latihan/dist') / path.relative_to(ROOT / 'dist'))
    archive.write(ROOT / 'docs/archive/MULAI.md', 'SOMA-Archive-latihan/MULAI.md')
    for name in ['operator.md', 'architecture.md', 'verification.md']:
        archive.write(ROOT / 'docs/archive' / name, Path('SOMA-Archive-latihan/panduan') / name)

manifest = []
for path in [source, build]:
    with ZipFile(path) as archive:
        assert archive.testzip() is None
        count = len(archive.namelist())
    manifest.append({'file':path.name, 'bytes':path.stat().st_size,
                     'sha256':hashlib.sha256(path.read_bytes()).hexdigest(), 'entries':count})
(OUT / 'checksums.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps(manifest, indent=2))
