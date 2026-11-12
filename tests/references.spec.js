import {test,expect} from '@playwright/test';
test('both preserved reference entry points work',async({page})=>{
 test.skip(!process.env.ORIGINAL_GAME_URL||!process.env.CITY_PROTOTYPE_URL,'Start both preserved reference servers and set their URLs to run this check.');
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.ORIGINAL_GAME_URL);await page.waitForFunction(()=>!!window.STACKER);await expect(page.locator('#opening')).toBeVisible();
 await page.goto(process.env.CITY_PROTOTYPE_URL);await page.waitForFunction(()=>!!window.HEX_CITY);await expect(page.locator('#money')).toHaveText('5,000');expect(await page.evaluate(()=>Object.keys(HEX_CITY.state.tiles).length)).toBe(13);
 expect(errors).toEqual([]);
});
