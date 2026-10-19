import {test,expect} from '@playwright/test';
import {plot} from './helpers.js';
import {freshSave,SAVE_KEY} from '../shared/store.js';
test('pause, restart, exit, reload recovery and isolated reset',async({page})=>{
 const save=freshSave();save.profile={name:'Navigator',opening:true,tutorial:true};
 page.setDefaultTimeout(20000);
 await page.addInitScript(({save,key})=>{if(!sessionStorage.getItem('seeded')){localStorage.setItem(key,JSON.stringify(save));localStorage.setItem('asterra-progress-v2','reference-sentinel');sessionStorage.setItem('seeded','1');}},{save,key:SAVE_KEY});await page.goto('/');
 await expect(page.locator('#hubLoading')).toBeHidden();
 const start=async()=>{await page.locator('#hub-contracts').click();await page.locator('#hubChooseSite').click();await plot(page,0,1);await page.locator('#hubConfirm').click();await expect(page.locator('#contractHUD')).toBeVisible();};
 await start();await page.locator('#pauseBtn').click();await expect(page.locator('#pause')).toBeVisible();await page.locator('#pRestartBtn').click();await expect(page.locator('#pause')).toBeHidden();
 expect((await page.evaluate(()=>ASTERRA.save)).activeRun).toMatchObject({index:0,q:0,r:1});
 await page.locator('#pauseBtn').click();await page.locator('#pHomeBtn').click();await expect(page.locator('#cityHub')).toBeVisible();expect((await page.evaluate(()=>ASTERRA.save)).activeRun).toBeNull();
 await start();await page.reload();await expect(page.locator('#hubLoading')).toBeHidden();const recovered=await page.evaluate(()=>ASTERRA.save);expect(recovered.activeRun).toBeNull();expect(recovered.city.tiles['0,1'].reserved).toBeUndefined();expect(recovered.coins).toBe(1200);
 await page.locator('#hubReset').click();await page.locator('#hubResetCancel').click();await expect(page.locator('#hubGreeting')).toContainText('Navigator');
 await page.locator('#hubReset').click();await page.locator('#hubResetConfirm').click();await expect(page.locator('#opening')).toBeVisible();expect(await page.evaluate(()=>localStorage.getItem('asterra-progress-v2'))).toBe('reference-sentinel');
});
