import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const scripts=readFileSync(new URL('../scripts/prepare-pose-worker.mjs',import.meta.url),'utf8');
const client=readFileSync(new URL('../src/stage/replayInferenceWorkerClient.ts',import.meta.url),'utf8');
const worker=readFileSync(new URL('../src/stage/replayInferenceWorker.ts',import.meta.url),'utf8');
const ui=readFileSync(new URL('../src/studio/v3/FootprintsExperimentalSource.tsx',import.meta.url),'utf8');

test('S0 bundles classic IIFE worker for both local Vite and GitHub Pages',()=>{
 assert.match(scripts,/format:'iife'/);
 assert.match(scripts,/replay-inference-classic\.js/);
 assert.match(client,/type:'classic'/);
 assert.doesNotMatch(client,/type:'module'/);
 assert.match(client,/import\.meta\.env\.BASE_URL\+'workers\/replay-inference-classic\.js'/);
});
test('S0 waits for MediaPipe pose and D3 crop model, preserving primary fallback',()=>{
 assert.match(worker,/await prepareRescue\(\)/);
 assert.match(worker,/poseReady:true,d3Ready:!!rescue/);
 assert.match(worker,/d3Reason:rescueFailure\|\|undefined/);
 assert.match(worker,/function guidedDual33/);
 assert.match(worker,/poses\[rawIndex\]=refined/);
 assert.match(client,/Worker classic gagal/);
 assert.match(client,/this\.boot=\{/);
 assert.match(client,/this\.worker\.terminate\(\)/);
});
test('S0 retains real crop diagnostics inside opt-in QA Lab, outside default Tracking',()=>{
 assert.match(ui,/showTechnicalLab&&<details className="fp-d4-performance"/);
 assert.match(ui,/snapshot\.d3\?\.reason/);
 assert.match(ui,/D3 waktu crop/);
});
