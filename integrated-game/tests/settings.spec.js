import {test,expect} from '@playwright/test';
import {freshSave,SAVE_KEY} from '../shared/store.js';
import {plot} from './helpers.js';
test('settings save identity, keys and comfort; remapped controls work in stacking',async({page})=>{
 const save=freshSave();save.profile={name:'Mia',opening:true,tutorial:true};const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({save,key})=>{if(!sessionStorage.getItem('settings-fixture')){localStorage.setItem(key,JSON.stringify(save));sessionStorage.setItem('settings-fixture','1');}},{save,key:SAVE_KEY});
 await page.goto('/');await expect(page.locator('#hubLoading')).toBeHidden();await page.locator('#hubSettings').click();
 await page.locator('#settingName').fill('Nova');await page.locator('#saveSettingName').click();
 await page.locator('[data-action="rotate"]').click();await page.keyboard.press('e');await expect(page.locator('[data-action="rotate"] kbd')).toHaveText('E');
 await page.locator('[data-action="flip"]').click();await page.keyboard.press('e');await expect(page.locator('#settingsMessage')).toContainText('already uses');await page.keyboard.press('Escape');
 await page.locator('#settingSound').uncheck();await page.locator('#settingCamera').focus();await page.keyboard.press('End');for(let i=0;i<5;i++)await page.keyboard.press('ArrowLeft');
 await page.screenshot({path:'docs/settings.png'});await page.locator('#closeSheet').click();await expect(page.locator('#hubGreeting')).toContainText('Nova');
 await page.reload();await expect(page.locator('#hubLoading')).toBeHidden();const settings=await page.evaluate(()=>ASTERRA.save.settings);expect(settings).toMatchObject({keys:{rotate:'e',flip:'f'},sound:false,cameraSensitivity:1.5});
 await page.locator('#hub-contracts').click();await page.locator('#hubChooseSite').click();await plot(page,0,1);await page.locator('#hubConfirm').click();await expect(page.locator('#contractHUD')).toBeVisible();
 await page.locator('#gearBtn').click();await expect(page.locator('#sheet h2')).toHaveText('SETTINGS');expect(await page.locator('#tuneGrid,#grantBtn,#fillBtn').count()).toBe(0);await page.keyboard.press('Escape');await page.locator('#resumeBtn').click();
 const rotation=await page.evaluate(()=>{if(!STACKER.S.piece)STACKER.spawn();const b=STACKER.S.piece.q.toArray();window.dispatchEvent(new KeyboardEvent('keydown',{key:'e',bubbles:true}));const a=STACKER.S.piece.q.toArray();window.dispatchEvent(new KeyboardEvent('keydown',{key:'r',bubbles:true}));return {b,a,old:STACKER.S.piece.q.toArray()};});expect(rotation.a).not.toEqual(rotation.b);expect(rotation.old).toEqual(rotation.a);
 await page.locator('#pauseBtn').click();await page.locator('#pTuneBtn').click();await page.locator('#resetSettingKeys').click();await expect(page.locator('[data-action="rotate"] kbd')).toHaveText('R');expect(errors).toEqual([]);
});
