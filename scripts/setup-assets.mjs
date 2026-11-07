import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const models = [
  ['face_landmarker.task', 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task', '64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff'],
  ['hand_landmarker.task', 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task', 'fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1'],
  ['pose_landmarker_lite.task', 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task', '59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a'],
];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
await mkdir(resolve(root, 'public/models'), { recursive: true });
await mkdir(resolve(root, 'public/wasm'), { recursive: true });
for (const [name, url, sha] of models) {
  const target = resolve(root, 'public/models', name);
  const current = await readFile(target).catch(() => null);
  if (current && digest(current) === sha) continue;
  console.log(`Downloading ${name} from official MediaPipe storage…`);
  const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (digest(bytes) !== sha) throw new Error(`${name}: SHA-256 mismatch`);
  await writeFile(target, bytes);
}
for (const name of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm', 'vision_wasm_nosimd_internal.js', 'vision_wasm_nosimd_internal.wasm']) {
  await copyFile(resolve(root, 'node_modules/@mediapipe/tasks-vision/wasm', name), resolve(root, 'public/wasm', name));
}
await copyFile(resolve(root, 'node_modules/@mediapipe/tasks-vision/vision_bundle.cjs'), resolve(root, 'public/wasm/vision_bundle.cjs'));
console.log('MediaPipe assets ready. Run npm run dev.');
