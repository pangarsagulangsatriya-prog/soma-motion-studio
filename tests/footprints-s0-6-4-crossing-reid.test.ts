import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MoveNetIdentityTracker,type D2Pose} from '../src/stage/moveNetIdentityTracker.ts';

const W=1000,H=600;
const red=[1,0,0,0],blue=[0,1,0,0],unknown=null;
function pose(x:number):D2Pose{
 const px=x*W,py=H*.5;
 const keypoints=Array.from({length:17},()=>({x:px,y:py,score:.96}));
 for(const [i,dx,dy] of [[5,-20,-55],[6,20,-55],[11,-20,55],[12,20,55]]){
  keypoints[i]={x:px+dx,y:py+dy,score:.96};
 }
 return {score:.97,box:{xMin:px-36,yMin:py-85,width:72,height:170},keypoints};
}
function frame(tracker:MoveNetIdentityTracker,a:number,b:number,t:number,
 colors:(number[]|null)[]=[red,blue],reversed=false){
 const people=[pose(a),pose(b)],descriptors=[...colors];
 if(reversed){people.reverse();descriptors.reverse();}
 return tracker.observeDescriptors(people,descriptors,W,H,t,.3);
}
test('S0.6.4: A/B survive physical crossing even when raw detector order changes',()=>{
 const tracker=new MoveNetIdentityTracker();
 frame(tracker,.20,.80,1);
 frame(tracker,.29,.71,101,[red,blue],true);
 frame(tracker,.38,.62,201);
 const overlap=frame(tracker,.47,.53,301,[red,blue],true);
 assert.equal(overlap.assignments.length,0);
 assert.equal(overlap.held,true);
 const recovering=frame(tracker,.57,.43,401);
 assert.equal(recovering.assignments.length,0);
 assert.ok(recovering.actors.every(a=>a.presence==='reacquiring'));
 frame(tracker,.67,.33,501,[red,blue],true);
 const restored=frame(tracker,.77,.23,601);
 assert.deepEqual(restored.assignments.map(a=>a.id),['A','B']);
 assert.ok(restored.assignments.find(a=>a.id==='A')!.center.x>.7);
 assert.ok(restored.assignments.find(a=>a.id==='B')!.center.x<.3);
 assert.deepEqual(restored.recovered,['A','B']);
});
test('S0.6.4: stale or ambiguous crossing never silently swaps A/B',()=>{
 const tracker=new MoveNetIdentityTracker();
 frame(tracker,.25,.75,1,[unknown,unknown]);
 frame(tracker,.38,.62,101,[unknown,unknown]);
 frame(tracker,.48,.52,201,[unknown,unknown]);
 const unresolved=frame(tracker,.50,.50,301,[unknown,unknown]);
 assert.equal(unresolved.assignments.length,0);
 const one=tracker.observeDescriptors([pose(.52)],[unknown],W,H,401,.3);
 assert.equal(one.assignments.length,0);
 assert.equal(one.held,true);
 assert.ok(one.actors.every(a=>a.presence!=='visible'));
 tracker.reset();
 assert.equal(frame(tracker,.20,.80,1).assignments.length,2);
});
test('S0.6.4 runs inside the main MP4 tracking engine and is not a separate panel',()=>{
 const engine=readFileSync(new URL('../src/stage/VideoPoseGaitEngine.ts',import.meta.url),'utf8');
 const tracker=readFileSync(new URL('../src/stage/moveNetIdentityTracker.ts',import.meta.url),'utf8');
 assert.match(engine,/new MoveNetIdentityTracker\(\)/);
 assert.match(tracker,/crossingActive/);
 assert.match(tracker,/reIdEvidence/);
 assert.match(tracker,/colorDistance/);
 assert.match(tracker,/RECOVERY_STREAK=3/);
});
