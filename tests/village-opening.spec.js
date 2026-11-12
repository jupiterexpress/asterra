import {test,expect} from '@playwright/test';
test('prototype village houses crumble into debris during the earthquake',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.locator('#contractorName').fill('Mia');await page.locator('#contractorForm button').click();await page.locator('#openingNext').click();
 await page.waitForFunction(()=>STACKER.Opening.visual.status.models.every(name=>/^House_[123]$/.test(name)));
 expect(await page.evaluate(()=>STACKER.Opening.visual.status.intact)).toBe(7);await page.screenshot({path:'docs/village-before-quake.png'});
 await page.locator('#openingNext').click();await page.waitForFunction(()=>STACKER.Opening.visual.status.intact===2);expect(await page.evaluate(()=>STACKER.Opening.visual.status.rubble)).toBe(4);
 await page.screenshot({path:'docs/village-after-quake.png'});await page.locator('#openingBack').click();await page.waitForFunction(()=>STACKER.Opening.visual.status.intact===7);expect(errors).toEqual([]);
});
