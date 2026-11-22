import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
 actorChannel,resolveActorColor,migrateLegacyFootStyle,DEFAULT_ACTOR_PALETTE
} from '../src/footprints/lines/v3/ActorPaletteResolver.ts';
import {
 buildPresentationStroke,clearPresentationCache,presentationCacheSize
} from '../src/footprints/lines/v3/PresentationStrokeBuilder.ts';
import type {V3Stroke,V3Point} from '../src/footprints/lines/v3/DualFootTrajectoryEngine.ts';

const pt=(x:number,y:number,atMs:number):V3Point=>({
 x,y,rawX:x,rawY:y,atMs,receivedAtMs:atMs,confidence:1,anchor:'heel-toe-center'
});
const stroke=(id:number,points:V3Point[],actorId='A',foot:'left'|'right'='left'):V3Stroke=>
 ({id,sourceKey:'test',actorId,foot,points});

test('V3.1 defaults to performer identity: A red both feet, B charcoal both feet',()=>{
 assert.equal(actorChannel('performer-1'),'A');
 assert.equal(actorChannel('performer-2'),'B');
 assert.equal(resolveActorColor('A','left',DEFAULT_ACTOR_PALETTE,{},'#F5F5F2'),'#E44F32');
 assert.equal(resolveActorColor('A','right',DEFAULT_ACTOR_PALETTE,{},'#F5F5F2'),'#E44F32');
 assert.equal(resolveActorColor('B','left',DEFAULT_ACTOR_PALETTE,{},'#F5F5F2'),'#242424');
 assert.equal(resolveActorColor('B','right',DEFAULT_ACTOR_PALETTE,{},'#F5F5F2'),'#242424');
});

test('Charcoal B adapts to dark canvas but explicit foot or actor colors are honoured',()=>{
 assert.equal(resolveActorColor('B','right',DEFAULT_ACTOR_PALETTE,{},'#111512'),'#D8D6D0');
 assert.equal(resolveActorColor('B','right',{...DEFAULT_ACTOR_PALETTE,B:'#CC9933'}, {},'#111512'),'#CC9933');
 assert.equal(resolveActorColor('B','right',DEFAULT_ACTOR_PALETTE,{B:{right:'#3377CC'}},'#111512'),'#3377CC');
 assert.equal(resolveActorColor('B','left',DEFAULT_ACTOR_PALETTE,{B:{right:'#3377CC'}},'#F5F5F2'),'#242424');
});

test('Legacy left/right preset preserves colors only as foot overrides, never actor IDs',()=>{
 const migrated=migrateLegacyFootStyle({
  colors:{left:'#E44F32',right:'#289B92'},visible:{left:false,right:true}
 });
 assert.equal(migrated.actorColors.A,'#E44F32');
 assert.equal(migrated.actorColors.B,'#242424');
 assert.deepEqual(migrated.footOverrides.A,{left:'#E44F32',right:'#289B92'});
 assert.deepEqual(migrated.footOverrides.B,{left:'#E44F32',right:'#289B92'});
 assert.equal(migrated.footVisible.B.left,false);
});

test('fluid smoothing is locally bounded, respects exact 90-degree corner',()=>{
 clearPresentationCache();
 const s=stroke(1,[pt(.20,.30,100),pt(.50,.30,133),pt(.50,.60,166)]);
 const smooth=buildPresentationStroke(s,'fluid',1600,900);
 assert.equal(smooth.hiddenAsMicroStroke,false);
 assert.ok(smooth.points.length>3);
 const targets=[[320,270],[800,270],[800,540]];
 for(const target of targets){
  assert.ok(smooth.points.some(p=>Math.hypot(p.x-target[0],p.y-target[1])<.001));
 }
 const distanceTo=(p:{x:number;y:number},a:number[],b:number[])=>{
  const dx=b[0]-a[0],dy=b[1]-a[1],q=((p.x-a[0])*dx+(p.y-a[1])*dy)/(dx*dx+dy*dy);
  const t=Math.max(0,Math.min(1,q));return Math.hypot(p.x-a[0]-t*dx,p.y-a[1]-t*dy);
 };
 assert.ok(smooth.points.every(p=>Math.min(
  distanceTo(p,targets[0],targets[1]),distanceTo(p,targets[1],targets[2]))<=8.001));
 assert.deepEqual(s.points.map(p=>[p.x,p.y]),[[.2,.3],[.5,.3],[.5,.6]]);
});

test('style switches only transform presentation; source points and cut reason unchanged',()=>{
 clearPresentationCache();
 const s=stroke(2,[pt(.30,.4,100),pt(.35,.43,133),pt(.41,.52,166),pt(.45,.57,200)]);
 s.cutReason='foot-missing';
 const orig=JSON.stringify(s);
 const precision=buildPresentationStroke(s,'precision',1600,900);
 const fluid=buildPresentationStroke(s,'fluid',1600,900);
 const paint=buildPresentationStroke(s,'paint',1600,900);
 assert.equal(precision.points.length,4);
 assert.ok(fluid.points.length>precision.points.length);
 assert.ok(paint.points.length>precision.points.length);
 assert.equal(JSON.stringify(s),orig);
 assert.equal(s.cutReason,'foot-missing');
});

test('tiny fragments are hidden in fluid/paint display, not in precision or data',()=>{
 const s=stroke(3,[pt(.20,.30,10),pt(.201,.301,43)]);
 assert.equal(buildPresentationStroke(s,'precision',1600,900).points.length,2);
 assert.equal(buildPresentationStroke(s,'fluid',1600,900).points.length,0);
 assert.equal(buildPresentationStroke(s,'paint',1600,900).hiddenAsMicroStroke,true);
 assert.equal(s.points.length,2);
});

test('presentation cache avoids stale geometry from same ID after take reset and remains bounded',()=>{
 clearPresentationCache();
 const first=stroke(1,[pt(.10,.20,10),pt(.2,.25,30),pt(.3,.29,60)]);
 const reset=stroke(1,[pt(.10,.20,10),pt(.25,.35,30),pt(.3,.29,60)]);
 const a=buildPresentationStroke(first,'fluid',1600,900);
 const b=buildPresentationStroke(reset,'fluid',1600,900);
 assert.notDeepEqual(a.points,b.points);
 for(let i=0;i<350;i++){
  buildPresentationStroke(stroke(i+20,[pt(.2,.3,10),pt(.3,.4,20),pt(.4,.5,30)]),
   'fluid',1600,900);
 }
 assert.ok(presentationCacheSize()<=256);
});
