export type Sample={x:number;y:number;t:number;side:number;join:boolean;heading:number;stamp?:boolean};
export const palettes=[['Ivory / Coal','#0C1010','#E8E5D8','#C6D0CD'],['Indigo / Coral','#0B1122','#8187EA','#FF8E76'],['Acid / Ice','#08120D','#D2FA54','#73E6F0'],['Rust / Chalk','#18120F','#D47949','#EAD9BC'],['Slate / Gold','#0E1318','#8CACC2','#DDB765'],['Night / Magenta','#090717','#8D79FF','#F36BB8']];
export const sole='M-.2 .48 C-.48 .46 -.35 .1 -.3 -.05 C-.4 -.32 -.3 -.59 -.06 -.62 C.22 -.67 .4 -.42 .32 -.22 C.25 -.07 .07 .02 .13 .21 C.24 .45 .05 .59 -.2 .48Z';
export type Recipe={style:string;palette:number;mirror:boolean;size:number};
export function patternSVG(samples:Sample[],r:Recipe,transparent=false){
 const p=palettes[r.palette]||palettes[0],last:(Sample|null)[]=[null,null];const shapes:string[]=[];
 for(const m of samples){const x=(r.mirror?1-m.x:m.x)*1280,y=m.y*720,old=last[m.side],color=p[2+m.side];
 if(r.style==='Tapak'&&m.stamp){const angle=((r.mirror?Math.PI-m.heading:m.heading)+Math.PI/2)*180/Math.PI;shapes.push(`<g fill="${color}" transform="translate(${x} ${y}) rotate(${angle}) scale(${m.side?-r.size:r.size} ${r.size})"><path d="${sole}"/>${Array.from({length:5},(_,i)=>`<ellipse cx="${-.23+i*.14}" cy="${-.75+(i/4)**2*.26}" rx="${.08-i*.007}" ry="${.11-i*.012}"/>`).join('')}</g>`);}
 else if(r.style==='Garis'&&old&&m.join)shapes.push(`<path fill="none" stroke="${color}" stroke-width="3" d="M${(r.mirror?1-old.x:old.x)*1280} ${old.y*720}L${x} ${y}"/>`);
 else if(r.style==='Titik')shapes.push(`<circle fill="${color}" cx="${x}" cy="${y}" r="3"/>`);last[m.side]=m;
 }return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">${transparent?'':`<rect width="1280" height="720" fill="${p[1]}"/>`}${shapes.join('')}</svg>`;
}
export function validateSession(raw:unknown):{samples:Sample[];recipe:Recipe}{
 const a=raw as {schema?:string;version?:number;samples?:Sample[];recipe?:Recipe};
 if(!a||a.schema!=='soma.footprints.session'||a.version!==2||!Array.isArray(a.samples)||a.samples.length>100000)throw Error('Format sesi tidak didukung.');
 let last=-1;for(const m of a.samples){if(!m||![m.x,m.y,m.t,m.heading].every(Number.isFinite)||m.x<0||m.x>1||m.y<0||m.y>1||m.t<last||![0,1].includes(m.side)||typeof m.join!=='boolean'||typeof m.stamp!=='boolean')throw Error('Data gerak tidak valid.');last=m.t;}
 const r=a.recipe;if(!r||!['Tapak','Garis','Titik'].includes(r.style)||!Number.isInteger(r.palette)||r.palette<0||r.palette>=palettes.length||typeof r.mirror!=='boolean'||!Number.isFinite(r.size)||r.size<12||r.size>90)throw Error('Pengaturan pola tidak valid.');return {samples:a.samples,recipe:r};
}
export function smoothSample(old:Sample|null,p:{x:number;y:number},t:number,heading:number,side:number):Sample{
 const gap=old?t-old.t:Infinity,join=!!old&&gap>0&&gap<350&&Math.hypot(p.x-old.x,p.y-old.y)<.2;
 const alpha=join?1-Math.exp(-gap/35):1;const angle=old?Math.atan2(Math.sin(heading-old.heading),Math.cos(heading-old.heading)):0;
 return {x:join?old!.x+alpha*(p.x-old!.x):p.x,y:join?old!.y+alpha*(p.y-old!.y):p.y,t,heading:join?old!.heading+alpha*angle:heading,side,join,stamp:false};
}
