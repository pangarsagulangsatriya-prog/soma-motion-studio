import test from 'node:test';
import assert from 'node:assert/strict';
import {PORTS,defaultUnpackingGraph,graphErrors,compileCuePlan,assessCueInputs,
 type NodeGraph} from '../src/studio/v5/NodeGraphModel.ts';

test('SOMA V5: single persistent graph has three cameras and two projector sinks',()=>{
 const graph=defaultUnpackingGraph();
 assert.deepEqual(graphErrors(graph),[]);
 assert.equal(graph.nodes.filter(n=>n.kind==='camera').length,3);
 assert.deepEqual(graph.nodes.filter(n=>n.kind.endsWith('-output')).map(n=>n.id),['floor','canvas']);
 assert.deepEqual(PORTS['floor-output'].inputs,{frame:'frame'});
});

test('SOMA V5 F1: same actor video fans out to footprint, upper trace and session recorder',()=>{
 const plan=compileCuePlan(defaultUnpackingGraph(),'F1');
 assert.deepEqual(plan.outputs,['floor','canvas']);
 assert.deepEqual(plan.requiredSources,['cam1']);
 for(const [source,target] of [['cam1','pose'],['pose','foot'],['pose','trace'],
  ['foot','rec'],['trace','rec'],['foot','floorMix'],['trace','canvasMix']]){
  assert.ok(plan.edges.some(e=>e.from.nodeId===source&&e.to.nodeId===target),
   source+' must feed '+target);
 }
 assert.ok(plan.nodes.some(n=>n.id==='rec'));
 assert.ok(!plan.nodes.some(n=>n.id==='capture'));
});

test('SOMA V5 F2: archive goes to canvas only and leaves floor inactive',()=>{
 const plan=compileCuePlan(defaultUnpackingGraph(),'F2');
 assert.deepEqual(plan.outputs,['canvas']);
 assert.deepEqual(plan.requiredSources,['archive']);
 assert.deepEqual(plan.edges.map(e=>e.from.nodeId+'>'+e.to.nodeId),
  ['archive>canvasMix','canvasMix>canvas']);
});

test('SOMA V5 F3A: camera 02 image and camera 03 gesture converge at capture',()=>{
 const plan=compileCuePlan(defaultUnpackingGraph(),'F3A');
 assert.deepEqual(plan.requiredSources,['cam2','cam3']);
 assert.deepEqual(plan.outputs,['canvas']);
 for(const [source,target] of [['cam2','capture'],['cam3','hand'],['hand','capture'],
  ['capture','canvasMix'],['canvasMix','canvas']])
  assert.ok(plan.edges.some(e=>e.from.nodeId===source&&e.to.nodeId===target));
 assert.ok(!plan.nodes.some(n=>n.id==='rec'),'F3A cannot overwrite F1 recording');
});

test('SOMA V5 F3B: saved F1 is the replay source for both outputs, not a live feedback cycle',()=>{
 const plan=compileCuePlan(defaultUnpackingGraph(),'F3B');
 assert.deepEqual(plan.requiredSources,['archive','saved','photos']);
 assert.deepEqual(plan.outputs,['floor','canvas']);
 for(const [source,target] of [['saved','replay'],['replay','floorMix'],
  ['replay','canvasMix'],['photos','canvasMix'],['archive','canvasMix']])
  assert.ok(plan.edges.some(e=>e.from.nodeId===source&&e.to.nodeId===target));
 assert.ok(!plan.nodes.some(n=>n.id==='rec'));
 assert.ok(!plan.nodes.some(n=>n.id==='cam1'));
});

test('SOMA V5: invalid connection, missing node, duplicate route and duplicate source are rejected',()=>{
 const original=defaultUnpackingGraph();
 const wrong=structuredClone(original);
 wrong.edges.push({id:'wrong',from:{nodeId:'cam1',port:'video'},to:{nodeId:'floor',port:'frame'}});
 assert.ok(graphErrors(wrong).some(e=>e.includes('incompatible ports')));
 const missing=structuredClone(original);
 missing.edges[0].from.nodeId='deleted';
 assert.ok(graphErrors(missing).some(e=>e.includes('missing node')));
 const repeated=structuredClone(original);
 repeated.edges.push({...repeated.edges[0],id:'repeat'});
 assert.ok(graphErrors(repeated).some(e=>e.includes('Multiple writers')));
 const invalid=structuredClone(original);
 invalid.nodes.push({...invalid.nodes[0]});
 assert.ok(graphErrors(invalid).some(e=>e.includes('Duplicate')));
 assert.throws(()=>compileCuePlan(wrong,'F1'),/Invalid graph/);
});

test('SOMA V5: cue preflight respects stale and offline inputs without claiming LIVE permission',()=>{
 const graph=defaultUnpackingGraph();
 const first=compileCuePlan(graph,'F1');
 assert.deepEqual(assessCueInputs(first,{cam1:'ready'}),{
  status:'ready',missing:[],reason:'Sumber siap untuk preview'
 });
 assert.deepEqual(assessCueInputs(first,{cam1:'stale'}).missing,['cam1']);
 assert.equal(assessCueInputs(first,{cam1:'stale'}).status,'blocked');
 const f3a=compileCuePlan(graph,'F3A');
 assert.deepEqual(assessCueInputs(f3a,{cam2:'ready',cam3:'offline'}).missing,['cam3']);
 assert.ok(!('transport' in first));
 assert.ok(!('armed' in first));
 assert.ok(!('live' in first));
});

test('SOMA V5: saved node removal blocks F3B but preserves F1',()=>{
 const graph:NodeGraph=defaultUnpackingGraph();
 graph.nodes=graph.nodes.filter(n=>n.id!=='saved');
 graph.edges=graph.edges.filter(e=>e.from.nodeId!=='saved');
 assert.doesNotThrow(()=>compileCuePlan(graph,'F1'));
 assert.throws(()=>compileCuePlan(graph,'F3B'),/missing required nodes: saved/);
});
