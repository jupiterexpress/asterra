import {test,expect} from '@playwright/test';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {runScenario,SCENARIOS}=require('./scenario.cjs');
test('current original and integrated copy produce identical seeded gameplay',async({page})=>{
 test.skip(!process.env.ORIGINAL_GAME_URL,'Set ORIGINAL_GAME_URL to a local server for the unchanged parent game.');
 const run=async(url)=>{
   await page.goto(url);await page.waitForFunction(()=>!!window.STACKER);
   return page.evaluate(({fn,scenarios})=>{const simulate=new Function('return '+fn)();return scenarios.map(s=>({name:s.name,runs:simulate(s)}));},{fn:runScenario.toString(),scenarios:SCENARIOS});
 };
 const original=await run(process.env.ORIGINAL_GAME_URL);
 const copy=await run('http://127.0.0.1:4190/index.html');
 expect(copy).toEqual(original);
 console.log('Identical current gameplay across 14 seeds in four scenarios.');
});
