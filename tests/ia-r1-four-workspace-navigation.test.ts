import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');

test('IA-R1: only Track, Compose, Map, Perform appear as four primary destinations',()=>{
 const nav=read('../src/studio/v3/GlobalNav.tsx');
 const top=nav.slice(nav.indexOf('className="soma-rail-scroll soma-primary-nav-list"'),
  nav.indexOf('className="soma-primary-labs-launch"'));
 for(const name of ['Track','Compose','Map','Perform']){
  assert.equal((top.match(new RegExp('aria-label="'+name+'"','g'))??[]).length,1,name);
 }
 assert.equal((top.match(/soma-primary-destination/g)??[]).length,4);
 assert.ok(!top.includes('aria-label="Footprints"'));
 assert.ok(!top.includes('aria-label="Projector"'));
 assert.match(nav,/aria-label="Tools · SOMA Labs"/);
});

test('IA-R1: global routes resolve to the real Stage compositor and diagnostics',()=>{
 const nav=read('../src/studio/v3/GlobalNav.tsx');
 const app=read('../src/App.tsx');
 const stage=read('../src/studio/v3/FootprintsStageWorkspace.tsx');
 assert.match(nav,/target==='track'\)onStageTool\('tracking'\)/);
 assert.match(nav,/target==='compose'\)onFootprints\(\)/);
 assert.match(nav,/target==='map'\)onStageTool\('mapping'\)/);
 assert.match(nav,/else onPerform\(\)/);
 assert.match(app,/setSelectedStageTool\('composer'\)/);
 assert.match(app,/tool:'composer'/);
 assert.match(stage,/case 'tracking':setView\('stage'\)/);
 assert.match(stage,/case 'composer':setView\('stage'\)/);
 assert.match(stage,/case 'mapping':setView\('stage'\)/);
 assert.match(stage,/<SurfaceComposer embedded sceneId=\{floorScene\} mapMode=\{mappingOpen\}/);
});

test('IA-R1: no second Footprints source picker or stage tabs underneath the global navigation',()=>{
 const stage=read('../src/studio/v3/FootprintsStageWorkspace.tsx');
 const nav=read('../src/studio/v3/GlobalNav.tsx');
 assert.ok(!stage.includes('<FootprintsSourceSwitcher'));
 assert.ok(!stage.includes('uxr3-compose-switcher'));
 assert.ok(!stage.includes('fp-flow-local-tabs'));
 assert.match(nav,/<details className="soma-uxr1-source"/);
 assert.match(stage,/!experimentalKind&&<QuickStageSetup/);
 assert.match(stage,/experimentalKind&&<FootprintsExperimentalSource/);
 assert.match(stage,/data-workspace=\{operatorMode\?'perform':composerOpen\?/);
});

test('IA-R1: shared stage source does not reinitialize on each destination',()=>{
 const app=read('../src/App.tsx');
 const stage=read('../src/studio/v3/FootprintsStageWorkspace.tsx');
 assert.match(app,/onSelectSource=\{choice=>\{/);
 assert.match(app,/setStageNavigation\(last=>\(\{id:\(last\?\.id\?\?0\)\+1,tool:'tracking'\}\)\)/);
 assert.match(stage,/const \[experimentClip,setExperimentClip\]=useState/);
 assert.match(stage,/key=\{experimentalKind\} kind=\{experimentalKind\}/);
 assert.match(stage,/hidden=\{view!=='stage'\|\|composerOpen\}/);
 assert.equal((stage.match(/new FloorInteractionEngine\(/g)||[]).length,1);
});

test('IA-R1: Compose has compact media/layers/presets and one Hydra inspector',()=>{
 const composer=read('../src/studio/v3/SurfaceComposer.tsx');
 const stage=read('../src/studio/v3/FootprintsStageWorkspace.tsx');
 for(const cls of ['soma-ia-media','soma-ia-layers','soma-ia-presets','soma-ia-hydra'])
  assert.ok(composer.includes(cls),cls);
 assert.match(composer,/onHydraSettingsChange\?\.\(\{enabled:e.target.checked\}\)/);
 assert.match(stage,/hydraSettings=\{hydraSettings\} onHydraSettingsChange=\{updateHydra\}/);
 assert.ok(!composer.includes('Advanced Mapping &amp; Output QA'));
 assert.match(composer,/if\(mapMode\)return <section className="map-r1-workspace"/);
});

test('IA-R1: entering Perform restores visible monitor and has source-aware status',()=>{
 const app=read('../src/App.tsx');
 const stage=read('../src/studio/v3/FootprintsStageWorkspace.tsx');
 assert.match(stage,/setComposerOpen\(false\);setMappingOpen\(false\);/);
 assert.match(stage,/previewStatus=\{experimentalKind==='video'\?/);
 assert.match(app,/if\(footprintsActive&&footprintsOperator&&!clean\)return;/);
 assert.match(app,/if\(!footprintsOperator\)setFootprintsOperator\(true\)/);
});

test('IA-R1: blackout remains a command, physical output gated and Compose can explicitly resume software',()=>{
 const nav=read('../src/studio/v3/GlobalNav.tsx');
 const app=read('../src/App.tsx');
 const stage=read('../src/studio/v3/FootprintsStageWorkspace.tsx');
 const composer=read('../src/studio/v3/SurfaceComposer.tsx');
 assert.match(nav,/aria-label="Kirim perintah blackout SOMA"/);
 assert.match(app,/onBlackout=\{\(\)=>\{/);
 assert.match(composer,/window.addEventListener\(SOFTWARE_PREVIEW_BLACKOUT_EVENT,onGlobalBlackout\)/);
 assert.match(app,/requestSoftwarePreviewBlackout\(\)/);
 assert.match(composer,/setBlackout\(false\);setPreviewLive\(true\)/);
 assert.match(stage,/setPreviewResumeRevision\(v=>v\+1\)/);
 assert.match(composer,/experimentLocked=\{experimentLocked\}/);
});

test('IA-R1: minimal status/source and keyboard work on 390px viewport',()=>{
 const css=read('../src/studio/v3/ia-r1-four-workspaces.css');
 const nav=read('../src/studio/v3/GlobalNav.tsx');
 assert.match(css,/@media\(max-width:430px\)/);
 assert.match(css,/soma-uxr1-health\{display:flex!important/);
 assert.match(nav,/const \[mobile,setMobile\]=useState/);
 assert.match(nav,/aria-expanded=\{expanded\}/);
 assert.match(nav,/onClick=\{\(\)=>navigate\('track'\)\}/);
});
