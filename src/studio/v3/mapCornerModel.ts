/** MAP-R1: pointer projection geometry helper. Does not touch hardware or grant QA. */
import type {Quad} from '../../projection/geometry.ts';
export type MapQuadGroup='sourceQuad'|'projectorQuad';
export type MapCornerIndex=0|1|2|3;
export function normalizedPointer(x:number,y:number,width:number,height:number){
 if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return null;
 return {x:Math.max(0,Math.min(1,x/width)),y:Math.max(0,Math.min(1,y/height))};
}
export function moveMapCorner(quad:Quad,index:MapCornerIndex,next:{x:number;y:number}):Quad{
 if(!Number.isInteger(index)||index<0||index>3||!Number.isFinite(next.x)||!Number.isFinite(next.y))throw Error('Titik kalibrasi tidak valid.');
 return quad.map((p,i)=>i===index?{x:Math.round(Math.max(0,Math.min(1,next.x))*1000)/1000,y:Math.round(Math.max(0,Math.min(1,next.y))*1000)/1000}:{...p}) as Quad;
}
