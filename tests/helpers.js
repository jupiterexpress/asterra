export function finishTutorial(){
 const G=window.STACKER,T=G.Tutorial;G.place();const wrongDropBlocked=G.S.phase==='aim'&&G.S.pending===0;T.tick(13.1);const hint=document.getElementById('tutorialHint').textContent;
 for(let i=0;i<8&&T.stageFor(G.S.piece)===0;i++)G.tip();
 for(let i=0;i<4&&T.stageFor(G.S.piece)===1;i++)G.rotate();
 G.S.piece.t=0;G.turn();G.S.piece.t=-1;G.step(1,1/60,true);const aligned=T.stageFor(G.S.piece)===4;G.place();G.step(120,1/60,true);
 return {wrongDropBlocked,hint,aligned,mode:T.mode};
}
export function solveContract(){
 const G=window.STACKER,C=G.Contract,S=G.S;
 const key=cells=>cells.map(c=>c.join(',')).sort().join('|');let attempts=0;
 while(S.phase!=='over'&&S.phase!=='finishing'&&attempts++<C.plan.tiles){
  G.step(60,1/60,true);const p=S.piece;if(!p)break;let best=null;
  for(let stance=0;stance<p.stances.length;stance++){
   for(let spin=0;spin<4;spin++){
    for(const [x,z] of C.plan.columns){
     if(!p.cells.every(c=>G.World.has(x+c[0],-1,z+c[2])))continue;
     const y=G.Physics.findLanding(p.cells,x,z);if(y===null||!G.Physics.evaluate(p.cells,x,y,z).stable)continue;
     let gain=0,outside=0;for(const c of p.cells){if(C.plan.keys.has([x+c[0],y+c[1],z+c[2]].join(',')))gain++;else outside++;}
     const score=gain*20-outside*12-y;if(!best||score>best.score)best={x,z,score,key:key(p.cells)};
    }G.rotate();
   }G.tip();
  }
  if(!best||best.score<0){if(C.ready()){C.finishRequested=true;G.step(1,1/60,true);break;}G.place();G.step(160,1/60,true);continue;}
  let aligned=false;for(let stance=0;stance<p.stances.length&&!aligned;stance++){for(let spin=0;spin<4;spin++){if(key(p.cells)===best.key){aligned=true;break;}G.rotate();}if(!aligned)G.tip();}
  p.axis='x';p.cross=best.z;p.t=best.x;G.place();G.step(150,1/60,true);
  if(C.ready()&&C.filled()/C.plan.cells.length>=.85){C.finishRequested=true;G.step(1,1/60,true);}
 }
 G.step(240,1/60,true);const before=C.coins;C.showResults();
 return {result:C.result,phase:S.phase,placed:S.placed,attempts,balance:C.coins,duplicatePaid:C.coins!==before,sameCells:C.building&&key(C.cells())===key([...C.building.keys].map(k=>k.split(',').map(Number))),sourceHidden:S.pieces.every(p=>!p.root.visible)};
}
export async function plot(page,q,r){const p=await page.evaluate(([q,r])=>ASTERRA.screen(q,r),[q,r]);await page.mouse.click(p.x,p.y);await page.waitForFunction(([q,r])=>document.getElementById('hubPlot').textContent.startsWith(`HEX ${q} / ${r}`),[q,r]);}
export async function buy(page,tool,q,r){await page.locator('#hub-manage').click();await page.locator(`[data-tool="${tool}"]`).click();await plot(page,q,r);await page.locator('#hubConfirm').click();}
