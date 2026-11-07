import {copyFile,mkdir} from 'node:fs/promises';
const folder=new URL('../public/wasm/',import.meta.url);await mkdir(folder,{recursive:true});
await copyFile(new URL('../node_modules/@mediapipe/tasks-vision/vision_bundle.cjs',import.meta.url),new URL('vision_bundle.cjs',folder));
