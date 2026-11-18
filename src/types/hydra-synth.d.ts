declare module 'hydra-synth' {
 type HydraShader={modulate:(other:HydraShader,amount?:number|(()=>number))=>HydraShader;
  blend:(other:HydraShader,amount?:number|(()=>number))=>HydraShader;
  diff:(other:HydraShader,amount?:number|(()=>number))=>HydraShader;
  scale:(amount?:number|(()=>number))=>HydraShader;
  rotate:(amount?:number|(()=>number))=>HydraShader;
  out:(buffer?:unknown)=>void;};
 type HydraSource={init:(options:{src:HTMLCanvasElement})=>void};
 type HydraSynth={
  s0:HydraSource;o0:unknown;
  src:(source:unknown)=>HydraShader;
  noise:(scale?:number|(()=>number),offset?:number|(()=>number))=>HydraShader;
  osc:(frequency?:number|(()=>number),sync?:number|(()=>number),offset?:number|(()=>number))=>HydraShader;
  render:(buffer?:unknown)=>void;
  hush?:()=>void;
 };
 export default class Hydra{
  constructor(options:{canvas:HTMLCanvasElement;width:number;height:number;autoLoop:boolean;makeGlobal:boolean;detectAudio:boolean;enableStreamCapture:boolean});
  synth:HydraSynth;
  tick:(dt:number)=>void;
  regl?:{destroy?:()=>void};
 }
}
