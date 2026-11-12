import {test,expect} from '@playwright/test';
import {finishTutorial,solveContract,plot,buy} from './helpers.js';
test('fresh story to tutorial, contract, persistent city and meaningful purchases',async({page})=>{
 test.setTimeout(300000);const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('/');await expect(page.locator('#opening')).toBeVisible();await page.locator('#contractorName').fill('Mia');await page.locator('#contractorForm button').click();
 for(let i=1;i<=8;i++)await page.locator('#openingNext').click();
 await expect(page.locator('#tutorialOverview')).toBeVisible();await page.locator('#tutorialStart').click();
 const tutorial=await page.evaluate(finishTutorial);expect(tutorial).toMatchObject({wrongDropBlocked:true,aligned:true,mode:'complete'});expect(tutorial.hint).toContain('FLIP');
 await page.locator('#tutorialContinue').click();await expect(page.locator('#cityHub')).toBeVisible();await expect(page.locator('#hubLoading')).toBeHidden();await expect(page.locator('#hubGreeting')).toContainText('Mia');
 expect(await page.locator('[data-tool="cottage"]').count()).toBe(0);
 await buy(page,'land',-3,0);await expect(page.locator('#hubMoney')).toHaveText('700');
 // Failed purchase and cancellation leave money unchanged.
 await page.locator('[data-tool="pond"]').click();await plot(page,0,1);await expect(page.locator('#hubConfirm')).toBeDisabled();await page.locator('#hubCancel').click();await expect(page.locator('#hubMoney')).toHaveText('700');
 await page.locator('#hub-contracts').click();await expect(page.locator('#hubContractList button').nth(1)).toBeDisabled();await page.locator('#hubChooseSite').click();await plot(page,0,1);await page.locator('#hubConfirm').click();
 await expect(page.locator('#contractHUD')).toBeVisible();await page.evaluate(()=>STACKER.CFG.seed=37);
 // Restart uses the same reserved site and the known seed, without changing rules.
 await page.evaluate(()=>STACKER.Contract.start());
 const result=await page.evaluate(solveContract);console.log('REPRESENTATIVE_CONTRACT',JSON.stringify(result));
 expect(result.result?.complete,JSON.stringify(result)).toBe(true);expect(result.sameCells).toBe(true);expect(result.sourceHidden).toBe(true);expect(result.duplicatePaid).toBe(false);
 await page.screenshot({path:'test-results/stacking-complete.png'});await page.locator('#nextContract').click();await expect(page.locator('#hubLoading')).toBeHidden();
 let saved=await page.evaluate(()=>ASTERRA.save);expect(saved.completed[0].site).toEqual([0,1]);expect(saved.city.tiles['0,1'].cells).toEqual(result.result.cells);expect(saved.coins).toBe(result.balance);
 const keys=await page.evaluate(()=>ASTERRA.renderedBuildings);expect(keys['built-0'].sort()).toEqual(result.result.cells.map(c=>c.join(',')).sort());
 await page.locator('#hub-contracts').click();await page.locator('#hubContractList button').nth(0).click();await expect(page.locator('#hubChooseSite')).toBeHidden();await expect(page.locator('#hubCompletedInfo')).toContainText('Rewards already collected');
 await page.reload();await expect(page.locator('#hubLoading')).toBeHidden();expect((await page.evaluate(()=>ASTERRA.save)).completed[0].site).toEqual([0,1]);
 // Bridge uses the initial pond and an EMPTY eastern bank, without opposite stone paths.
 saved=await page.evaluate(()=>ASTERRA.save);expect(saved.city.tiles['1,0'].kind).toBe(null);
 await buy(page,'bridge',0,0);await buy(page,'road',1,0);
 // Finish the remaining contracts through the same unchanged placement physics to fund the garden and pond.
 for(const [index,q,r] of [[1,-1,1],[2,0,-1]]){
  await page.locator('#hub-contracts').click();await page.locator('#hubContractList button').nth(index).click();await page.locator('#hubChooseSite').click();await plot(page,q,r);await page.locator('#hubConfirm').click();
  await page.evaluate(()=>{STACKER.CFG.seed=37;STACKER.Contract.start();});const r2=await page.evaluate(solveContract);console.log('CONTRACT_'+index,JSON.stringify(r2));expect(r2.result?.complete,JSON.stringify(r2)).toBe(true);await page.locator('#nextContract').click();await expect(page.locator('#hubLoading')).toBeHidden();
 }
 await buy(page,'garden',0,1);await buy(page,'pond',2,-1);await buy(page,'path',-2,0);await buy(page,'lantern',1,0);
 const beforeReload=await page.evaluate(()=>ASTERRA.save);await page.screenshot({path:'test-results/integrated-city.png'});await page.reload();await expect(page.locator('#hubLoading')).toBeHidden();
 const afterReload=await page.evaluate(()=>ASTERRA.save);expect(afterReload.coins).toBe(beforeReload.coins);expect(afterReload.completed).toEqual(beforeReload.completed);expect(afterReload.city.tiles).toEqual(beforeReload.city.tiles);
 expect(await page.evaluate(()=>Object.keys(localStorage))).toEqual(['asterra-integrated-v1']);expect(errors).toEqual([]);
});
