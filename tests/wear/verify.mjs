import {chromium} from '@playwright/test';import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/Users/miatura29/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto('http://127.0.0.1:4195/tests/wear/gallery.html');await page.waitForFunction(()=>window.galleryReady);
 const matrix=await page.evaluate(async()=>{
  const {makeBuilding}=await import('/src/village-buildings.js'),{CONTRACTS}=await import('/src/blueprints.js'),results=[];
  for(const plan of CONTRACTS)for(const grade of ['A+','A','B','C','D']){
   const b=makeBuilding(plan.cells,plan,{grade,garden:true});await b.ready;let finite=true,clipped=true,unclipped=true;
   b.group.traverse(o=>{const a=o.geometry?.attributes.position;if(a)for(let i=0;i<a.count;i++)finite&&=Number.isFinite(a.getX(i))&&Number.isFinite(a.getY(i))&&Number.isFinite(a.getZ(i));});
   b.reveal(.5);b.group.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])clipped&&=!!m.clippingPlanes?.length;});
   b.reveal(1);b.group.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])unclipped&&=!m.clippingPlanes;});
   results.push({plan:plan.index,...b.group.userData.wear,finite,clipped,unclipped,keys:[...b.keys].sort()});b.dispose();
  }return results;
 });
 for(const r of matrix){assert.ok(r.finite&&r.clipped&&r.unclipped,JSON.stringify(r));assert.equal(r.boarded,r.grade==='D'?2:0);assert.equal(r.missing,['C','D'].includes(r.grade)?1:0);assert.equal(r.wallCracks,r.grade==='A+'?0:r.grade==='A'?1:2);assert.equal(r.looseTiles,['B','C','D'].includes(r.grade)?1:0);assert.equal(r.missingTiles,r.grade==='D'?4:r.grade==='C'?1:0);if(r.grade==='D'){assert.ok(r.chippedCorner);assert.ok(r.cracked>r.panes/2);}}
 for(const grade of ['A+','B','D']){
  await page.goto('http://127.0.0.1:4195/tests/wear/gallery.html?grade='+encodeURIComponent(grade)+'&noGarden&progress=.62');await page.waitForFunction(()=>window.galleryReady);
  // Start partially revealed; the production reveal is intentionally forward-only.
  await page.screenshot({path:`docs/wear/reveal-${grade.replace('+','plus')}-partial.png`});
  await page.evaluate(()=>{buildings[0].reveal(1);render();});await page.screenshot({path:`docs/wear/reveal-${grade.replace('+','plus')}.png`});
  assert.notDeepEqual(readFileSync(`docs/wear/reveal-${grade.replace('+','plus')}-partial.png`),readFileSync(`docs/wear/reveal-${grade.replace('+','plus')}.png`));
 }
 const saved=JSON.parse(readFileSync(new URL('./legacy-save.json',import.meta.url),'utf8'));
 // Seed from the isolated gallery before the application starts: its pagehide save
 // must not overwrite the fixture with the fresh session we are leaving.
 await page.evaluate(s=>localStorage.setItem('asterra-integrated-v1',JSON.stringify(s)),saved);await page.goto('http://127.0.0.1:4195/');await page.waitForFunction(()=>window.ASTERRA&&Object.keys(ASTERRA.renderedBuildings||{}).length===3);
 const summary=await page.evaluate(async()=>{const{Home}=await import('/src/home.js');return Home.world.wearSummary();});
 assert.equal(summary.find(t=>t.q===0&&t.r===-1).building.grade,'D');assert.equal(summary.find(t=>t.q===1&&t.r===-1).environment.foliage,'dead');assert.equal(summary.find(t=>t.q===-1&&t.r===0).environment.lanternsLit,false);
 const after=await page.evaluate(()=>ASTERRA.save);assert.deepEqual(after.city.tiles,saved.city.tiles);assert.deepEqual(after.completed,saved.completed);assert.equal(after.coins,saved.coins);
 await page.screenshot({path:'docs/wear/legacy-city.png'});await page.reload();await page.waitForFunction(()=>window.ASTERRA&&Object.keys(ASTERRA.renderedBuildings||{}).length===3);
 const reloaded=await page.evaluate(async()=>{const{Home}=await import('/src/home.js');return Home.world.wearSummary();});assert.deepEqual(reloaded,summary);
 await page.goto('http://127.0.0.1:4195/tests/wear/city.html');await page.waitForFunction(()=>window.galleryReady);await page.screenshot({path:'docs/wear/city-grade-comparison.png'});
 const environment=await page.evaluate(()=>report());assert.deepEqual(environment.filter(t=>t.kind==='path').map(t=>t.environment.lanternsLit),[true,true,false]);assert.deepEqual(environment.filter(t=>t.kind==='grove').map(t=>t.environment.foliage),['healthy','browning','dead']);
 assert.deepEqual(errors,[]);writeFileSync('docs/wear/browser-results.json',JSON.stringify({matrix,legacySave:{tilesUnchanged:true,completedUnchanged:true,coinsUnchanged:true,wearRestoredAfterReload:true},environment,errors},null,2)+'\n');console.log('PASS: 15 model/grade combinations, reveal clipping, old-save/reload integrity, garden coexistence, grove/lantern grades; no browser errors.');
}catch(error){console.error({errors,body:await page.locator('body').innerText().catch(()=>'' )});await page.screenshot({path:'docs/wear/verification-failure.png'}).catch(()=>{});throw error;}finally{await browser.close();}
