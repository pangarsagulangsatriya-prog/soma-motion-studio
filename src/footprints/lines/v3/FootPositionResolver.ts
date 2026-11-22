import type {Landmark} from '../../../engine/types.ts';
import type {FootLineSample} from '../FootLineSampleAdapter.ts';

export type FootV3Sample=FootLineSample&{
 anchor:'heel-toe-center'|'ankle-fallback'|'simulated';
 ankle?:{x:number;y:number};heel?:{x:number;y:number};toe?:{x:number;y:number};
};
type Side='left'|'right';
type Meta=Pick<FootLineSample,'sessionId'|'generation'|'source'|'actorId'|'atMs'|'coordinateBasis'>;
const valid=(p:Landmark|undefined,threshold=.55):p is Landmark=>
 !!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&
 p.y>=0&&p.y<=1&&Number.isFinite(p.visibility??1)&&(p.visibility??1)>=threshold;
const pos=(p:Landmark)=>({x:p.x,y:p.y});
/**
 * Preserve actual heel/toe and ankle anchors for debugging.
 * Heading never determines the observed path position.
 * Pivot compensation happens in DualFootTrajectoryEngine; both anchors stay raw.
 */
export function resolvePoseFeet(pose:readonly Landmark[],meta:Meta):FootV3Sample[]{
 if(!Number.isFinite(meta.atMs)||meta.atMs<0)return [];
 const samples:FootV3Sample[]=[];
 for(const foot of ['left','right'] as const){
  const offset=foot==='left'?0:1;
  const heel=pose[29+offset],toe=pose[31+offset],ankle=pose[27+offset];
  const hasAnkle=valid(ankle,.55);
  if(valid(heel)&&valid(toe)){
   const heading=Math.atan2((toe.x-heel.x)*16,(heel.y-toe.y)*9);
   samples.push({...meta,foot,anchor:'heel-toe-center',
    x:(heel.x+toe.x)/2,y:(heel.y+toe.y)/2,
    confidence:Math.min(heel.visibility??1,toe.visibility??1),
    headingRad:heading,
    heel:pos(heel),toe:pos(toe),...(hasAnkle?{ankle:pos(ankle)}:{})});
  }else if(valid(ankle,.72)){
   samples.push({...meta,foot,anchor:'ankle-fallback',x:ankle.x,y:ankle.y,
    confidence:(ankle.visibility??1)*.86,ankle:pos(ankle)});
  }
 }
 return samples;
}
export function fromLegacySample(sample:FootLineSample):FootV3Sample{
 return {...sample,anchor:'simulated'};
}
