#!/usr/bin/env node
/** Generate a clean, explicitly unsigned QA template or check signed manual evidence. */
import {readFileSync,writeFileSync} from 'node:fs';
import {emptyQaReleaseRecord,parseQaReleaseRecord,evaluateQaRelease} from '../src/studio/v3/qaReleaseGate.ts';
const [command,arg,revision]=process.argv.slice(2);
if(command==='init'){
 if(!arg||!revision){console.error('Usage: npm run qa:release -- init <file.json> <commit>');process.exitCode=2;}
 else{
  writeFileSync(arg,JSON.stringify(emptyQaReleaseRecord(revision),null,2)+'\n',{flag:'wx'});
  console.log('Template created with every evidence item PENDING: '+arg);
 }
}else if(command==='check'){
 if(!arg||!revision){console.error('Usage: npm run qa:release -- check <file.json> <commit>');process.exitCode=2;}
 else{
  try{
   const data=parseQaReleaseRecord(JSON.parse(readFileSync(arg,'utf8')));
   const result=evaluateQaRelease(data,revision);
   console.log(JSON.stringify({releaseEligible:result.eligible,
    automatedPass:result.automatedPass,physicalPass:result.physicalPass,
    blocking:result.blocking},null,2));
   if(!result.eligible)process.exitCode=1;
  }catch(error){console.error(error instanceof Error?error.message:String(error));process.exitCode=2;}
 }
}else{
 console.error('Usage: npm run qa:release -- init|check <file.json> <commit>');
 process.exitCode=2;
}
