/** MAT-03 — one shared GLSL liquid pigment function.
 * PixiJS v8 and the native WebGL2 reference import this exact function.
 * Every phase stays INSIDE the immutable GEO-01B anatomical alpha mask.
 */
export const MATERIAL03_GLSL=String.raw\`
float matHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float matNoise(vec2 p){
 vec2 i=floor(p),f=fract(p);
 f=f*f*(3.-2.*f);
 return mix(mix(matHash(i),matHash(i+vec2(1.,0.)),f.x),
  mix(matHash(i+vec2(0.,1.)),matHash(i+vec2(1.,1.)),f.x),f.y);
}
float matFbm(vec2 p){
 float a=.5,v=0.;
 for(int i=0;i<4;i++){v+=a*matNoise(p);p=p*2.03+3.71;a*=.5;}
 return v;
}
vec3 mat03Pigment(
 vec2 uv,float seconds,float seed,float flow,
 float contactFill,vec2 slide,float slideStrength,
 float twist,float pivotStrength,float releaseProgress,
 vec3 tint
){
 seconds=max(0.,seconds);
 // All motions deform sampling coordinates only; sole alpha stays intact.
 vec2 p=uv;
 float sl=clamp(slideStrength,0.,1.);
 vec2 travel=slide;
 float travelLen=max(length(travel),.001);
 vec2 dir=travel/travelLen;
 // Slide: ink pulls lengthwise; compact thin streaks parallel to travel.
 p-=dir*sl*(.10+.05*sin(seconds*4.));
 vec2 spin=p-vec2(.5,.5);
 float radius=length(spin);
 // Pivot: tangential roll around a grounded forefoot, a spiral INSIDE sole.
 float angular=clamp(twist,-.9,.9)*pivotStrength*(.4+radius*2.);
 p=vec2(cos(angular)*spin.x-sin(angular)*spin.y,
        sin(angular)*spin.x+cos(angular)*spin.y)+vec2(.5,.5);
 float velocity=.19+.26*flow;
 vec2 drift=vec2(
  matFbm(p*7.+vec2(seed*4.,-seconds*.25)),
  matFbm(p*8.+vec2(seconds*.24,seed*6.))
 )-.5;
 vec2 liquid=p+drift*(.082*flow)+vec2(
  .02*sin((p.y+seed)*16.-seconds*1.7),
  -seconds*velocity);
 float pool=matFbm(liquid*10.+vec2(seed*7.,seconds*.1));
 float folds=matFbm(liquid*17.-vec2(seconds*.23,seed*6.));
 float veins=1.-smoothstep(.07,.24,abs(sin(
  liquid.y*34.+liquid.x*6.+folds*8.)));
 float mineral=clamp(.10+.85*pool+.13*folds,0.,1.);
 vec3 pigment=mix(tint*.12,tint*1.02,mineral);
 pigment+=tint*(.34*veins)+vec3(.12,.15,.16)*pow(veins,2.);
 // CONTACT: an advancing front fills the foot heel-to-toe.
 // uContactFill=1 at first impact and decays to 0 over 320ms.
 float front=.13+.77*clamp(contactFill,0.,1.);
 float filled=smoothstep(front-.08,front+.09,uv.y);
 float wetRim=exp(-pow((uv.y-front)*23.,2.));
 pigment*=mix(1.,mix(.27,1.,filled),clamp(contactFill,0.,1.));
 pigment+=tint*.61*wetRim*contactFill;
 // SLIDE: directional filaments are elongated parallel to velocity.
 vec2 normal=vec2(-dir.y,dir.x);
 float crossAxis=dot(p-vec2(.5),normal);
 float slideLine=pow(.5+.5*sin(crossAxis*65.
  +matFbm(p*8.)*4.-seconds*1.9),12.);
 pigment+=tint*.79*slideLine*sl*min(1.,travelLen*2.);
 // PIVOT: tangential spiral veins around the inner ball of the foot.
 vec2 origin=p-vec2(.5,.38);
 float spiral=sin(atan(origin.y,origin.x)*4.2+
  log(max(.035,length(origin)))*10.-seconds*2.);
 float whorl=pow(.5+.5*spiral,12.);
 pigment+=tint*.74*whorl*clamp(pivotStrength,0.,1.);
 // RELEASE: colored ink drains away into a foot-shaped patchy residue.
 float drain=clamp(releaseProgress,0.,1.);
 float granules=matFbm(p*25.+vec2(seed*9.,seconds*.03));
 float residue=mix(1.,.18+.25*granules,drain);
 pigment*=residue;
 return clamp(pigment,0.,1.);
}
\`;
