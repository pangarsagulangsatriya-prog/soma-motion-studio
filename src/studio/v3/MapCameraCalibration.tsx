import {useCallback,useEffect,useRef,useState,type ComponentProps} from 'react';
import {Modal} from '../../components';
import {InlineFloorCalibration,type InlineCalibrationOverlay} from './InlineFloorCalibration';
type Props=Pick<ComponentProps<typeof InlineFloorCalibration>,
 'videoRef'|'tracker'|'router'|'cameraOn'|'bodySelected'|'videoReady'|'cameraMatched'|'onBlackout'|'onClose'>;
/** Calibrate the existing stream in Map without remounting the input or composer. */
export function MapCameraCalibration(props:Props){
 const canvas=useRef<HTMLCanvasElement>(null);
 const [overlay,setOverlay]=useState<InlineCalibrationOverlay|null>(null);
 const tap=useRef<((x:number,y:number)=>void)|null>(null);
 const bindTap=useCallback((handler:typeof tap.current)=>{tap.current=handler;},[]);
 const [point,setPoint]=useState({x:.5,y:.5});
 useEffect(()=>{
  let raf=0;
  const draw=()=>{
   raf=requestAnimationFrame(draw);
   const c=canvas.current,v=props.videoRef.current,ctx=c?.getContext('2d');
   if(!c||!ctx)return;
   ctx.clearRect(0,0,c.width,c.height);
   if(v&&v.readyState>=2&&v.videoWidth&&v.videoHeight){
    c.width=v.videoWidth;c.height=v.videoHeight;ctx.drawImage(v,0,0,c.width,c.height);
   }
  };
  raf=requestAnimationFrame(draw);return()=>cancelAnimationFrame(raf);
 },[props.videoRef]);
 return <Modal title="Tandai lantai pada kamera" onClose={props.onClose} wide>
  <div className="soma-map-camera-editor">
   <div className="soma-map-camera-image" style={{aspectRatio:props.videoRef.current?.videoWidth&&props.videoRef.current?.videoHeight?`${props.videoRef.current.videoWidth}/${props.videoRef.current.videoHeight}`:'16/9'}}>
    <canvas ref={canvas} width={768} height={432} tabIndex={0} role="button"
     aria-label="Tandai sudut lantai. Gunakan panah untuk menggeser penanda, Enter untuk menandai."
     onClick={event=>{
      const r=event.currentTarget.getBoundingClientRect();
      tap.current?.((event.clientX-r.left)/r.width,(event.clientY-r.top)/r.height);
     }} onKeyDown={event=>{
      const moves:Record<string,[number,number]>={ArrowLeft:[-.01,0],ArrowRight:[.01,0],ArrowUp:[0,-.01],ArrowDown:[0,.01]};
      const delta=moves[event.key];
      if(delta){event.preventDefault();setPoint(p=>({x:Math.max(0,Math.min(1,p.x+delta[0])),y:Math.max(0,Math.min(1,p.y+delta[1]))}));}
      if(event.key==='Enter'||event.key===' '){event.preventDefault();tap.current?.(point.x,point.y);}
     }}/>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
     {overlay?.marks.every(Boolean)&&<polygon points={overlay.marks.map(p=>`${p!.x*100},${p!.y*100}`).join(' ')} fill="#b9e4a320" stroke="#c7eba6" strokeWidth=".4"/>}
     {overlay?.marks.map((p,i)=>p&&<g key={i}><circle cx={p.x*100} cy={p.y*100} r="2" fill="#c7eba6"/><text x={p.x*100} y={p.y*100+1} textAnchor="middle" fontSize="3" fill="#122217">{i+1}</text></g>)}
     <circle className="soma-keyboard-marker" cx={point.x*100} cy={point.y*100} r="1" fill="none" stroke="white" strokeWidth=".3"/>
    </svg>
   </div>
   <InlineFloorCalibration {...props} onOpenQA={props.onClose} onOverlay={setOverlay} onTap={bindTap}/>
  </div>
 </Modal>;
}
