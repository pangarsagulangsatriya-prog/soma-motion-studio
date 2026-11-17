import {defineConfig} from '@playwright/test';
const viewports={
 'wide-1440':{width:1440,height:900},
 'laptop-1366':{width:1366,height:768},
 'tablet-1024':{width:1024,height:768},
 'mobile-390':{width:390,height:844}
};
export default defineConfig({
 testDir:'.',
 testMatch:'**/*.spec.mjs',
 timeout:40_000,
 expect:{timeout:10_000},
 retries:process.env.CI?1:0,
 workers:process.env.CI?2:undefined,
 reporter:[['list'],['json',{outputFile:'e2e/qa-result.json'}],['html',{outputFolder:'e2e/playwright-report',open:'never'}]],
 outputDir:'e2e/test-results',
 use:{
  baseURL:'http://127.0.0.1:4173',
  browserName:'chromium',headless:true,
  screenshot:'only-on-failure',
  trace:'retain-on-failure',
  actionTimeout:12_000,
  navigationTimeout:25_000,
  launchOptions:{args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']}
 },
 projects:Object.entries(viewports).map(([name,viewport])=>({
  name,use:{viewport}
 })),
 webServer:{
  command:'npm run dev -- --host 127.0.0.1',
  url:'http://127.0.0.1:4173/',
  reuseExistingServer:!process.env.CI,
  timeout:120_000
 }
});
