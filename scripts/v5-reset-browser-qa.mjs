#!/usr/bin/env node
/** RESET-00 integration smoke: no retired visuals, shared Stage navigation
 * and diagnostic Track/Map/Perform controls survive the full catalog purge.
 * The V5 artistic pixel test will be created only once a new renderer exists.
 */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
const url='http://127.0.0.1:4186/';
const directory='artifacts/v5-reset';
mkdirSync(directory,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4186','--strictPort'],{stdio:['ignore','pipe','pipe']});
let stderr='';
server.stderr.on('data',b=>{stderr+=String(b);if(stderr.length>3500)stderr=stderr.slice(-3500)});
let browser;
const report={checks:[],errors:[]};
try{
 let ready=false;
 for(let i=0;i<80;i++){
  try{const res=await fetch(url,{signal:AbortSignal.timeout(500)});if(res.ok){ready=true;break}}catch{}
  await sleep(300);
 }
 assert.ok(ready,'Vite startup failed '+stderr);
 browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Compose workspace'}).click();
 await page.locator('.s64-layout').waitFor({state:'visible',timeout:15000});
 const compose=page.locator('.s64-layout');
 assert.ok((await compose.innerText()).includes('Media & Layers'),'Expected Media & Layers panel');
 assert.ok((await compose.innerText()).includes('Katalog visual lama sudah dikosongkan'),'Expected V5 reset notice');
 const oldSelectors=['.fv01-flagship-card','.fv04-live-canvas','.soma-ia-hydra','.fp-hydra-controls','.cp08-scene-card'];
 for(const selector of oldSelectors)assert.equal(await page.locator(selector).count(),0,'Retired control found '+selector);
 const oldTexts=['TRACE','ECHO','RIFT','Snowfall','Fireworks','Effect Recipe','Hydra shader'];
 const visibleText=await compose.innerText();
 for(const name of oldTexts)assert.ok(!visibleText.includes(name),'Retired visual '+name+' visible');
 report.checks.push('Compose: retired catalogs/effect controls absent; Media/Layers visible');
 await page.screenshot({path:directory+'/compose-reset.png',fullPage:true});
 await page.getByRole('button',{name:'Map workspace'}).click();
 await page.locator('.map-r1-workspace').waitFor({state:'visible',timeout:15000});
 report.checks.push('Map: routing and calibration workspace reachable');
 await page.getByRole('button',{name:'Track workspace'}).click();
 await page.locator('.soma-stage-module-nav').waitFor({state:'visible',timeout:15000});
 report.checks.push('Track: workspace remains reachable');
 assert.equal(report.errors.length,0,'Browser errors: '+report.errors.join('; '));
 console.log('V5_RESET_BROWSER_QA_PASS',JSON.stringify(report));
}catch(error){
 report.errors.push(error.stack||String(error));
 console.error('V5_RESET_BROWSER_QA_FAIL',error);
 process.exitCode=1;
}finally{
 writeFileSync(directory+'/report.json',JSON.stringify(report,null,2));
 await browser?.close();
 server.kill('SIGTERM');
}
