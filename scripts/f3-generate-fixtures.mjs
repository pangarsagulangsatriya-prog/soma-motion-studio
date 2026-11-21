import {spawnSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
const dir='artifacts/f3-fixtures';mkdirSync(dir,{recursive:true});
const fixtures=[
 {name:'actor-a.mp4',filter:'color=c=0x1c2732:s=640x360:r=15:d=6,drawbox=x=265:y=115:w=88:h=180:color=0xb0c9e5:t=fill,drawbox=x=350:y=150:w=110:h=24:color=0xe2ba80:t=fill,drawbox=x=350:y=150:w=20:h=24:color=0x7bc3ef:t=fill'},
 {name:'feet-b.mp4',filter:'color=c=0x263327:s=640x360:r=15:d=6,drawbox=x=65:y=240:w=250:h=68:color=0xc7aa8c:t=fill,drawbox=x=340:y=230:w=245:h=68:color=0x927b67:t=fill,drawbox=x=80:y=265:w=210:h=25:color=0xddd3b0:t=fill'}
];
for(const f of fixtures){
 const args=['-hide_banner','-loglevel','error','-y','-f','lavfi','-i',f.filter,
  '-c:v','libvpx-vp9','-b:v','240k','-pix_fmt','yuv420p','-movflags','+faststart','-t','6',join(dir,f.name)];
 const run=spawnSync('ffmpeg',args,{stdio:'inherit'});
 if(run.status!==0)throw Error('ffmpeg failed for '+f.name+': '+(run.error?.message??'exit '+run.status));
 console.log('SIMULASI generated',f.name);
}
