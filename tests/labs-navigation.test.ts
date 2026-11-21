import test from 'node:test';
import assert from 'node:assert/strict';
import {LABS_GROUPS,LABS_ITEM_COUNT,searchLabs,searchStageTwoLabs,STAGE_TWO_ITEM_COUNT,STAGE_TWO_LAB_IDS} from '../src/studio/v3/labsCatalog.ts';

test('SOMA Labs preserves all visual, motion, capture, and gait destinations',()=>{
 assert.deepEqual(LABS_GROUPS.map(g=>g.id),['visual','motion','gait']);
 const ids=LABS_GROUPS.flatMap(g=>g.items.map(item=>item.id));
 assert.equal(ids.length,11);
 assert.equal(new Set(ids).size,11);
 assert.equal(LABS_ITEM_COUNT,ids.length);
 for(const id of ['liquid','echo','cut','body','hydra','sound','capture',
  'archive','video','rehearsal','simulator'])assert.ok(ids.includes(id as typeof ids[number]));
});
test('Labs search matches name, description, and group without hiding an unrelated module',()=>{
 const video=searchLabs('MP4');
 assert.deepEqual(video.flatMap(g=>g.items.map(i=>i.id)),['video']);
 const sound=searchLabs('suara');
 assert.ok(sound.some(g=>g.items.some(i=>i.id==='sound')));
 const named=searchLabs('Siluet');
 assert.deepEqual(named.flatMap(g=>g.items.map(i=>i.id)),['body']);
 const group=searchLabs('Motion');
 assert.ok(group.some(g=>g.id==='motion'));
 assert.deepEqual(searchLabs('  ').flatMap(g=>g.items).length,LABS_ITEM_COUNT);
 assert.equal(searchLabs('tak-ada-kategori-ini').length,0);
});
test('search handles casing, diacritics, and long inputs safely',()=>{
 assert.equal(searchLabs('VISUAL').flatMap(g=>g.items).length,5);
 assert.ok(searchLabs('TÉKS').flatMap(g=>g.items).some(i=>i.id==='liquid'));
 assert.equal(searchLabs('x'.repeat(150)).length,0);
});

test('Stage 2 exposes the eight legacy tools and keeps gait modules in Stage 1',()=>{
 assert.equal(STAGE_TWO_ITEM_COUNT,8);
 assert.deepEqual(searchStageTwoLabs('').flatMap(g=>g.items.map(i=>i.id)),[...STAGE_TWO_LAB_IDS]);
 assert.deepEqual(searchStageTwoLabs('textaire').flatMap(g=>g.items.map(i=>i.id)),['liquid']);
 assert.equal(searchStageTwoLabs('simulator').flatMap(g=>g.items).length,0);
 assert.equal(searchStageTwoLabs('video').flatMap(g=>g.items).length,0);
 assert.ok(searchStageTwoLabs('').every(group=>group.id!=='gait'));
});
