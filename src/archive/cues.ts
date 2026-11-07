import type {Cue,StageState} from './types.ts';
export class StageCues{
 state:StageState={index:0,phase:'ready',enteredAt:0,elapsedMs:0,freeze:false,blank:false,generation:0};private lastAction=-Infinity;
 ready(index:number,cues:Cue[],now:number){this.state={...this.state,index:Math.max(0,Math.min(index,cues.length-1)),phase:'ready',enteredAt:now,elapsedMs:0,freeze:false,generation:this.state.generation+1};}
 go(now:number){if(now-this.lastAction<180)return false;this.lastAction=now;if(this.state.phase==='running')return false;this.state.enteredAt=now-this.state.elapsedMs;this.state.phase='running';this.state.generation++;return true;}
 hold(now:number){if(this.state.phase==='running')this.state.elapsedMs=now-this.state.enteredAt;this.state.phase='hold';}
 tick(now:number,cues:Cue[]){if(this.state.phase!=='running')return false;this.state.elapsedMs=now-this.state.enteredAt;const c=cues[this.state.index];if(c?.autoNext&&c.durationMs>0&&this.state.elapsedMs>=c.durationMs&&this.state.index<cues.length-1){this.ready(this.state.index+1,cues,now);this.go(now);return true;}return false;}
}
