/** Shared GLSL procedural footprint shader library for PixiJS v8 WebGL2.
 * Every visual style (Mineral Ink, Neon Flux, Ember Thermal, Aurora Mist,
 * Topo Vector, Chromatic Ripple) stays strictly INSIDE the authentic 5-toe
 * left/right anatomical alpha mask and responds to contact/slide/pivot/release.
 */
export const MATERIAL03_GLSL=String.raw`
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
vec3 matHueRotate(vec3 col,float turns){
 float angle=turns*6.2831853;
 float c=cos(angle),s=sin(angle);
 vec3 k=vec3(.57735);
 return clamp(col*c+cross(k,col)*s+k*dot(k,col)*(1.-c),0.,1.);
}
vec3 mat03Pigment(
 vec2 uv,float seconds,float seed,float flow,
 float contactFill,vec2 slide,float slideStrength,
 float twist,float pivotStrength,float releaseProgress,
 vec3 tint
){
 seconds=max(0.,seconds);
 vec2 p=uv;
 float sl=clamp(slideStrength,0.,1.);
 vec2 travel=slide;
 float travelLen=max(length(travel),.001);
 vec2 dir=travel/travelLen;
 p-=dir*sl*(.10+.05*sin(seconds*4.));
 vec2 spin=p-vec2(.5,.5);
 float radius=length(spin);
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
 float front=.13+.77*clamp(contactFill,0.,1.);
 float filled=smoothstep(front-.08,front+.09,uv.y);
 float wetRim=exp(-pow((uv.y-front)*23.,2.));
 pigment*=mix(1.,mix(.27,1.,filled),clamp(contactFill,0.,1.));
 pigment+=tint*.61*wetRim*contactFill;
 vec2 normal=vec2(-dir.y,dir.x);
 float crossAxis=dot(p-vec2(.5),normal);
 float slideLine=pow(.5+.5*sin(crossAxis*65.
  +matFbm(p*8.)*4.-seconds*1.9),12.);
 pigment+=tint*.79*slideLine*sl*min(1.,travelLen*2.);
 vec2 origin=p-vec2(.5,.38);
 float spiral=sin(atan(origin.y,origin.x)*4.2+
  log(max(.035,length(origin)))*10.-seconds*2.);
 float whorl=pow(.5+.5*spiral,12.);
 pigment+=tint*.74*whorl*clamp(pivotStrength,0.,1.);
 float drain=clamp(releaseProgress,0.,1.);
 float granules=matFbm(p*25.+vec2(seed*9.,seconds*.03));
 float residue=mix(1.,.18+.25*granules,drain);
 pigment*=residue;
 return clamp(pigment,0.,1.);
}
vec3 composeStylePigment(
 vec2 uv,float seconds,float seed,float flow,
 float turbulence,float glow,float hueShift,float pulseRate,float styleId,
 float contactFill,vec2 slide,float slideStrength,
 float twist,float pivotStrength,float releaseProgress,
 vec3 tint
){
 seconds=max(0.,seconds);
 vec3 steeredTint=matHueRotate(tint,hueShift);
 float pulse=1.+.16*pulseRate*sin(seconds*(2.4+pulseRate*7.2)+seed*6.28);
 float turb=clamp(turbulence,0.,1.);
 float gl=clamp(glow,0.,1.);
 // Motion-warped coordinates shared across all creative-coding looks.
 vec2 p=uv;
 float sl=clamp(slideStrength,0.,1.);
 float travelLen=max(length(slide),.001);
 vec2 dir=slide/travelLen;
 p-=dir*sl*(.11+.05*sin(seconds*4.2));
 vec2 spin=p-vec2(.5,.5);
 float radius=length(spin);
 float angular=clamp(twist,-.9,.9)*pivotStrength*(.4+radius*2.);
 p=vec2(cos(angular)*spin.x-sin(angular)*spin.y,
        sin(angular)*spin.x+cos(angular)*spin.y)+vec2(.5,.5);
 vec3 pigment=vec3(0.);

 if(styleId<.5){
  // 0: Mineral Ink (organic fluid veins)
  pigment=mat03Pigment(uv,seconds,seed,clamp(flow*(.75+.5*turb),0.,1.),
   contactFill,slide,slideStrength,twist,pivotStrength,releaseProgress,steeredTint);
  pigment*=mix(.85,1.25,gl)*pulse;
 }else if(styleId<1.5){
  // 1: Neon Flux (electric plasma filaments & glowing edge energy)
  float t=seconds*(.6+flow*2.2);
  float n1=matFbm(p*(6.+turb*8.)+vec2(seed*5.,-t*.7));
  float n2=matFbm(p*(12.+turb*10.)+vec2(t*.5,seed*9.));
  float arc=exp(-abs(sin((p.y*12.+n1*5.+n2*3.)-t*2.4))*8.5);
  float arc2=exp(-abs(sin((p.x*16.-n2*6.)+t*1.9))*10.);
  vec3 hot=matHueRotate(steeredTint,.16)+vec3(.18,.22,.28);
  pigment=steeredTint*(.18+.42*n1)+steeredTint*(.95*arc)+hot*(.85*arc2);
  pigment+=vec3(.35,.42,.48)*pow(max(arc,arc2),2.2)*gl;
  pigment*=pulse;
 }else if(styleId<2.5){
  // 2: Ember Thermal (incandescent heat core cooling to volcanic ash)
  float t=seconds*(.35+flow*1.5);
  float heat=matFbm(p*(7.+turb*7.)+vec2(seed*4.,-t*.9));
  float crack=1.-smoothstep(.04,.22,abs(matFbm(p*(14.+turb*8.)+vec2(t*.3,seed*3.))-.5));
  float core=clamp(1.-length((p-vec2(.5,.48))*vec2(1.4,.95))*.95+.35*heat,0.,1.);
  float cool=clamp(releaseProgress,0.,1.);
  vec3 ember=mix(vec3(.16,.05,.04),steeredTint,clamp(core*1.15,0.,1.));
  ember+=vec3(1.,.92,.58)*pow(core,2.4)*(.45+.85*gl)*(1.-.65*cool);
  ember+=steeredTint*crack*(.55+.55*gl);
  pigment=ember*pulse;
 }else if(styleId<3.5){
  // 3: Aurora Mist (iridescent silk ribbons)
  float t=seconds*(.4+flow*1.6);
  float wave=sin(p.y*10.+matFbm(p*(4.+turb*6.)+vec2(t*.4,seed*5.))*5.5-t*1.6);
  float ribbon=.5+.5*wave;
  float shimmer=pow(.5+.5*sin(p.x*18.+p.y*8.-t*2.1+ribbon*4.),4.);
  vec3 colA=steeredTint;
  vec3 colB=matHueRotate(steeredTint,.24);
  pigment=mix(colA*.28,colB,ribbon)+mix(colB,vec3(.92,.98,1.),.45)*shimmer*(.45+.75*gl);
  pigment*=pulse;
 }else if(styleId<4.5){
  // 4: Topo Vector (generative topographic contour rings + scanlines)
  float t=seconds*(.3+flow*1.4);
  float elev=matFbm(p*(3.8+turb*5.5)+vec2(seed*6.,-t*.35));
  float rings=fract(elev*(6.+turb*9.)-t*.25);
  float line=1.-smoothstep(.03,.11,abs(rings-.5)*2.);
  float scan=.5+.5*sin(p.y*110.-t*6.);
  pigment=steeredTint*(.10+.14*elev)+steeredTint*(.85*line)*(1.+.45*gl);
  pigment+=steeredTint*.22*scan*line;
  pigment*=pulse;
 }else{
  // 5: Chromatic Ripple (concentric RGB interference from impact)
  float t=seconds*(.8+flow*2.4);
  vec2 c=p-vec2(.5,.52);
  float d=length(c*vec2(1.4,1.));
  float warp=matFbm(p*(5.+turb*6.)+vec2(seed*3.,t*.3))*(.06+.14*turb);
  float rCh=.5+.5*sin((d+warp)*36.-t*4.5);
  float gCh=.5+.5*sin((d+warp)*36.-t*4.5+1.15);
  float bCh=.5+.5*sin((d+warp)*36.-t*4.5+2.3);
  vec3 spec=matHueRotate(vec3(rCh,gCh,bCh),hueShift);
  pigment=mix(steeredTint*.35,spec,.78)*(.72+.55*gl)*pulse;
 }

 // Shared gait phase responses so every style remains physically readable:
 float front=.13+.77*clamp(contactFill,0.,1.);
 float filled=smoothstep(front-.08,front+.09,uv.y);
 float wetRim=exp(-pow((uv.y-front)*22.,2.));
 pigment*=mix(1.,mix(.32,1.,filled),clamp(contactFill,0.,1.));
 pigment+=steeredTint*(.55+.35*gl)*wetRim*contactFill;

 vec2 normal=vec2(-dir.y,dir.x);
 float crossAxis=dot(p-vec2(.5),normal);
 float slideLine=pow(.5+.5*sin(crossAxis*60.+matFbm(p*8.)*4.-seconds*2.1),10.);
 pigment+=steeredTint*(.7+.4*gl)*slideLine*sl*min(1.,travelLen*2.);

 vec2 origin=p-vec2(.5,.38);
 float spiral=sin(atan(origin.y,origin.x)*4.2+log(max(.035,length(origin)))*10.-seconds*2.2);
 float whorl=pow(.5+.5*spiral,10.);
 pigment+=steeredTint*(.68+.4*gl)*whorl*clamp(pivotStrength,0.,1.);

 float drain=clamp(releaseProgress,0.,1.);
 float granules=matFbm(p*24.+vec2(seed*9.,seconds*.03));
 pigment*=mix(1.,.20+.26*granules,drain);
 return clamp(pigment,0.,1.);
}
`;
