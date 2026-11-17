/** Shared lightweight interaction rules. Shift+Escape remains available
 * to stage safety handlers; ordinary Escape dismisses secondary UI. */
export const RAIL_TOOLTIP_DELAY_MS=260;
export function isDismissEscape(event:{key:string;shiftKey:boolean}){
 return event.key==='Escape'&&!event.shiftKey;
}
export function shouldOpenInspector(options:{
 sameStep:boolean;panelOpen:boolean;cameraOn:boolean;step:'input'|'process'|'compose'|'output';
 forceOpen?:boolean;
}){
 if(!options.forceOpen&&options.sameStep&&options.panelOpen)return false;
 return options.step==='input'?options.cameraOn:true;
}
export function shouldEnterInspectorByArrow(event:{key:string},selectedAndOpen:boolean){
 return event.key==='ArrowDown'&&selectedAndOpen;
}
