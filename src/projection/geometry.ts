export type Point={x:number;y:number};
export type Quad=[Point,Point,Point,Point];
export const identityQuad=():Quad=>[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}];
export const identityMatrix=()=>[1,0,0,0,1,0,0,0,1];
export function validQuad(q:unknown):q is Quad{
 if(!Array.isArray(q)||q.length!==4||!q.every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1))return false;
 let area=0;for(let i=0;i<4;i++){const a=q[i],b=q[(i+1)%4],c=q[(i+2)%4];if((b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x)<.002)return false;area+=a.x*b.y-b.x*a.y;}return area/2>.04;
}
export function correspondence(source:Quad,destination:Quad):number[]{
 if(!validQuad(source)||!validQuad(destination))throw Error('Empat titik 1–4 harus berurutan, cembung, dan cukup berjauhan.');
 const a:number[][]=[];source.forEach((s,i)=>{const d=destination[i];a.push([s.x,s.y,1,0,0,0,-d.x*s.x,-d.x*s.y,d.x],[0,0,0,s.x,s.y,1,-d.y*s.x,-d.y*s.y,d.y]);});
 for(let c=0;c<8;c++){let pivot=c;for(let r=c+1;r<8;r++)if(Math.abs(a[r][c])>Math.abs(a[pivot][c]))pivot=r;[a[c],a[pivot]]=[a[pivot],a[c]];const v=a[c][c];if(Math.abs(v)<1e-9)throw Error('Titik kalibrasi terlalu berdekatan.');for(let j=c;j<=8;j++)a[c][j]/=v;for(let r=0;r<8;r++)if(r!==c){const f=a[r][c];for(let j=c;j<=8;j++)a[r][j]-=f*a[c][j];}}
 const matrix=[...a.map(r=>r[8]),1];inverse3(matrix);return matrix;
}
export const homography=(q:Quad)=>correspondence(identityQuad(),q);
export function inverse3(m:number[]):number[]{const [a,b,c,d,e,f,g,h,i]=m;const out=[e*i-f*h,c*h-b*i,b*f-c*e,f*g-d*i,a*i-c*g,c*d-a*f,d*h-e*g,b*g-a*h,a*e-b*d];const det=a*out[0]+b*out[3]+c*out[6];if(!Number.isFinite(det)||Math.abs(det)<1e-10)throw Error('Kalibrasi tidak bisa dipetakan.');return out.map(v=>v/det);}
export function transform(m:number[],p:Point):Point{const z=m[6]*p.x+m[7]*p.y+m[8];return {x:(m[0]*p.x+m[1]*p.y+m[2])/z,y:(m[3]*p.x+m[4]*p.y+m[5])/z};}
export function multiply(a:number[],b:number[]):number[]{return Array.from({length:9},(_,i)=>{const row=Math.floor(i/3),col=i%3;return a[row*3]*b[col]+a[row*3+1]*b[3+col]+a[row*3+2]*b[6+col];});}
export const translation=(x:number,y:number)=>[1,0,x,0,1,y,0,0,1];
export const scaling=(x:number,y:number)=>[x,0,0,0,y,0,0,0,1];
export const compose=(...matrices:number[][])=>matrices.reduce(multiply,identityMatrix());
