/** CP-07 — shared object selection for the compositor canvas and the layer stack.
 * Input pixels use intrinsic canvas dimensions. Layer IDs survive layer reorder.
 * The renderer owns the cached image data; this model owns deterministic picking.
 */
export type PickableLayer={id:string;visible:boolean;opacity:number};
export type ObjectPick={layerId:string;layerIndex:number}|null;

export function normalizedCanvasPoint(
 clientX:number,clientY:number,rect:{left:number;top:number;width:number;height:number},
 canvas:{width:number;height:number}
):{x:number;y:number}|null{
 if(!Number.isFinite(clientX)||!Number.isFinite(clientY)||rect.width<=0||rect.height<=0||canvas.width<=0||canvas.height<=0)return null;
 const u=(clientX-rect.left)/rect.width,v=(clientY-rect.top)/rect.height;
 if(u<0||u>1||v<0||v>1)return null;
 return {x:Math.min(canvas.width-1,Math.floor(u*canvas.width)),y:Math.min(canvas.height-1,Math.floor(v*canvas.height))};
}
export function pickTopmostObject(
 layers:readonly PickableLayer[],
 getAlpha:(layerId:string)=>number,
 threshold=12
):ObjectPick{
 for(let i=layers.length-1;i>=0;i--){
  const layer=layers[i];
  if(!layer.visible||!Number.isFinite(layer.opacity)||layer.opacity<=0)continue;
  const alpha=getAlpha(layer.id);
  if(Number.isFinite(alpha)&&alpha*layer.opacity/100>=threshold)return {layerId:layer.id,layerIndex:i};
 }
 return null;
}
export function selectedLayerIndex<T extends {id:string}>(layers:readonly T[],id:string|null,fallback=0):number{
 const i=layers.findIndex(layer=>layer.id===id);
 return i>=0?i:Math.max(0,Math.min(layers.length-1,fallback));
}
export function nudgeLayer(
 value:{x:number;y:number},key:string,shiftKey=false
):{x:number;y:number}|null{
 const d=shiftKey?5:1;
 if(key==='ArrowLeft')return {x:Math.max(-100,Math.min(100,value.x-d)),y:value.y};
 if(key==='ArrowRight')return {x:Math.max(-100,Math.min(100,value.x+d)),y:value.y};
 if(key==='ArrowUp')return {x:value.x,y:Math.max(-100,Math.min(100,value.y-d))};
 if(key==='ArrowDown')return {x:value.x,y:Math.max(-100,Math.min(100,value.y+d))};
 return null;
}
