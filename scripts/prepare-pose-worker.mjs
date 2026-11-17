import {copyFile,mkdir} from 'node:fs/promises';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const folder=new URL('../public/wasm/',import.meta.url);await mkdir(folder,{recursive:true});
await copyFile(new URL('../node_modules/@mediapipe/tasks-vision/vision_bundle.cjs',import.meta.url),new URL('vision_bundle.cjs',folder));

// MediaPipe Vision WASM loads its runtime with importScripts(), requiring a
// classic worker. Bundle TS and ESM imports into one classic IIFE for BOTH
// Vite dev and GitHub Pages. Do not let Vite serve a TS module worker directly.
const outputFolder=new URL('../public/workers/',import.meta.url);
await mkdir(outputFolder,{recursive:true});
await build({
 entryPoints:[fileURLToPath(new URL('../src/stage/replayInferenceWorker.ts',import.meta.url))],
 outfile:fileURLToPath(new URL('replay-inference-classic.js',outputFolder)),
 bundle:true,format:'iife',platform:'browser',target:'es2022',
 sourcemap:false,legalComments:'none'
});
console.log('SOMA MediaPipe classic worker built (dev + Pages).');
