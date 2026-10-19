import {S} from './state.js';
import {Contract} from './contract.js';
import {CONTRACTS,voxelSVG} from './blueprints.js';
import {CFG} from './config.js';
import {Tutorial} from './tutorial.js';
import {Store} from '../shared/store.js';
import {catalog,validate,siteError,isLanding,key} from '../city/state.js';
import {createWorld} from '../city/world.js';
import {openSettings} from './ui.js';
const $=id=>document.getElementById(id);
export const Home={
 api:null,world:null,worldPromise:null,mode:'overview',selected:null,hover:null,tool:'land',rotation:0,index:0,clock:0,
 get active(){return !$('cityHub').hidden;},
 init(api){
  this.api=api;
  for(const mode of ['overview','contracts','manage'])$('hub-'+mode).onclick=()=>this.setMode(mode);
  $('hubNext').onclick=()=>this.setMode('contracts');
  $('hubChooseSite').onclick=()=>{this.selected=null;this.hover=null;this.setMode('site');this.message('Choose an empty meadow. You will build here through the stacking challenge.');};
  $('hubConfirm').onclick=()=>this.confirm();$('hubCancel').onclick=()=>this.cancel();$('hubRotate').onclick=()=>{this.rotation=(this.rotation+1)%6;this.render();};
  $('hubViewReset').onclick=()=>this.world?.reset();
  $('hubTutorial').onclick=()=>{Store.abort();this.hide();Tutorial.start();};
  $('hubReset').onclick=()=>$('hubResetDialog').showModal();
  $('hubSettings').onclick=()=>openSettings();
  $('hubResetCancel').onclick=()=>$('hubResetDialog').close();
  $('hubResetConfirm').onclick=()=>{Store.reset();location.reload();};
  $('hubInspectBuilt').onclick=()=>{const site=Store.data.completed[this.index]?.site;if(site)this.world?.focus(...site);this.setMode('overview');};
  $('contractBack').onclick=()=>this.show();$('districtHome').onclick=()=>this.show();
  for(const [tool,item] of Object.entries(catalog)){const b=document.createElement('button');b.dataset.tool=tool;b.innerHTML=`<i aria-hidden="true">${item.icon}</i><span>${item.name}</span><small>◇ ${item.price.toLocaleString()}</small>`;b.onclick=()=>{this.tool=tool;this.selected=null;this.hover=null;this.render();};$('hubCatalog').append(b);}
  const canvas=$('city-canvas');let down;
  canvas.addEventListener('pointerdown',e=>{if(e.button===0)down=[e.clientX,e.clientY];});
  canvas.addEventListener('pointerup',e=>{if(e.button!==0||!down||!this.world)return;const distance=Math.hypot(e.clientX-down[0],e.clientY-down[1]);down=null;if(distance>5)return;const hit=this.world.pick(e.clientX,e.clientY);if(!hit)return this.cancel();
   if(this.mode==='manage'||this.mode==='site'){this.selected={q:hit.q,r:hit.r};this.hover=null;this.render();}
   else {const t=Store.data.city.tiles[key(hit.q,hit.r)];if(t?.kind==='building'){this.index=t.contract;this.setMode('contracts');}else this.message('Open Contracts to build a home, or Manage city to shape the neighborhood.');}
  });
  canvas.addEventListener('pointermove',e=>{if(!this.world||this.selected||e.buttons||!['manage','site'].includes(this.mode))return;const hit=this.world.pick(e.clientX,e.clientY);if(hit?.q===this.hover?.q&&hit?.r===this.hover?.r)return;this.hover=hit?{q:hit.q,r:hit.r}:null;this.preview();});
  canvas.addEventListener('pointerleave',()=>{this.hover=null;this.preview();});canvas.addEventListener('contextmenu',e=>e.preventDefault());
  addEventListener('keydown',e=>{if(!this.active||S.screen!=='home'||e.ctrlKey||e.metaKey||e.altKey||e.repeat||$('hubResetDialog').open||!$('sheet').hidden)return;
   if(e.key==='Escape'){e.preventDefault();this.selected?this.cancel():this.setMode('overview');}
   if(e.key.toLowerCase()==='r'&&this.mode==='manage'){e.preventDefault();this.rotation=(this.rotation+1)%6;this.render();}
   if(e.key==='Enter'&&this.selected&&!$('hubConfirm').disabled){e.preventDefault();this.confirm();}
  });
  addEventListener('pagehide',()=>Store.save());
  window.ASTERRA={get save(){return structuredClone(Store.data);},screen:(q,r)=>this.world?.screen(q,r),get renderedBuildings(){return Home.world?.buildingKeys();},get mode(){return Home.mode;}};
 },
 async show(options={}){
  const completed=Contract.result?.complete;Store.recover();this.api.reset();S.screen='home';
  for(const id of ['home','controls','end','contractBrief','districtDone','tileValue'])$(id).hidden=true;
  $('hint').classList.add('gone');document.body.classList.add('integrated-hub');$('cityHub').hidden=false;
  this.index=options.index??Math.min(Store.data.nextIndex,2);this.mode=options.mode||'overview';this.selected=null;this.hover=null;
  this.render();$('hubLoading').hidden=!!this.world;
  try{
   this.worldPromise ||= createWorld($('city-canvas'));this.world=await this.worldPromise;
   this.world.rebuild(Store.data.city);$('hubLoading').hidden=true;this.render();
   this.message(Store.warning||(completed?'Your building is home. Its shape, reward, and chosen site are saved.':'Your city is saved automatically. Every new building begins with a stacking contract.'));
  }catch(error){console.error(error);$('hubLoading').textContent='The city could not load. Reload to try again.';}
 },
 hide(){this.selected=null;this.hover=null;this.world?.preview('land');$('cityHub').hidden=true;document.body.classList.remove('integrated-hub');S.screen='';},
 setMode(mode){this.mode=mode;this.selected=null;this.hover=null;if(mode==='contracts'&&this.index>Store.data.nextIndex)this.index=Math.min(Store.data.nextIndex,2);this.render();},
 message(text){$('hubMessage').textContent=text;},
 error(target){if(!target)return null;const {q,r}=target;return this.mode==='site'?(siteError(Store.data.city,q,r)||(isLanding(Store.data.city,q,r)?'This is a bridge landing. Choose another vacant hex.':null)):validate(Store.data.city,this.tool,q,r,this.rotation);},
 preview(){const target=this.selected||this.hover;this.world?.preview(this.mode==='site'?'site':this.tool,target?.q,target?.r,this.rotation,!!target&&!this.error(target));},
 render(){
  const d=Store.data;d.city.money=d.coins;$('hubMoney').textContent=d.coins.toLocaleString();$('hubProgress').textContent=`${d.nextIndex} / ${CONTRACTS.length} BUILT`;
  $('hubGreeting').textContent=d.profile.name?`Welcome home, ${d.profile.name}.`:'A place to begin again.';
  $('hubContracts').hidden=this.mode!=='contracts';$('hubTools').hidden=this.mode!=='manage';$('hubOverview').hidden=this.mode!=='overview';$('hubSiteGuide').hidden=this.mode!=='site';
  for(const mode of ['overview','contracts','manage'])$('hub-'+mode).setAttribute('aria-pressed',String(this.mode===mode));
  $('hubNextName').textContent=d.nextIndex<3?CONTRACTS[d.nextIndex].short:'A neighborhood, made by you';$('hubNext').textContent=d.nextIndex<3?'Explore next contract →':'Your completed contracts →';
  $('hubContractList').replaceChildren();
  CONTRACTS.forEach((p,i)=>{const b=document.createElement('button'),done=!!d.completed[i],locked=i>d.nextIndex;b.className='contract-tab'+(i===this.index?' chosen':'');b.disabled=locked;b.textContent=`${String(i+1).padStart(2,'0')}  ${p.short} · ${done?'BUILT · '+d.completed[i].grade:locked?'LOCKED':'AVAILABLE'}`;b.onclick=()=>{this.index=i;this.render();};$('hubContractList').append(b);});
  const p=CONTRACTS[this.index],done=d.completed[this.index];$('hubContractTitle').textContent=p.short;$('hubBlueprint').innerHTML=voxelSVG(done?.cells||p.cells);$('hubContractDescription').textContent=p.description;
  $('hubRequirements').textContent=`${p.tiles} tiles · ${Math.round(p.goal*100)}% target · ${p.w} × ${p.d} footprint`;
  const bonus=CFG.reward.contractBonus[this.index];$('hubReward').textContent=`Density reward: ${Math.round(p.cells.length*CFG.reward.perCell.D*bonus).toLocaleString()}–${Math.round(p.cells.length*CFG.reward.perCell['A+']*bonus).toLocaleString()} coins, plus timed tile earnings.`;
  $('hubChooseSite').hidden=!!done;$('hubChooseSite').disabled=this.index!==d.nextIndex;$('hubInspectBuilt').hidden=!done;$('hubCompletedInfo').hidden=!done;
  $('hubCompletedInfo').textContent=done?`Built at hex ${done.site.join(' / ')} · Grade ${done.grade}. Rewards already collected.`:'';
  document.querySelectorAll('#hubCatalog [data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===this.tool)));
  $('hubToolDescription').textContent=catalog[this.tool].description;
  $('hubPlacement').hidden=!this.selected;
  if(this.selected){const {q,r}=this.selected,error=this.error(this.selected);$('hubPlot').textContent=`HEX ${q} / ${r} · ${error?'UNAVAILABLE':'READY'}`;$('hubPlacementTitle').textContent=this.mode==='site'?p.short:catalog[this.tool].name;
   $('hubPlacementInfo').textContent=error||(this.mode==='site'?'Your stacked structure will become the building on this site.':`${catalog[this.tool].price.toLocaleString()} coins total. Confirm to purchase.`);
   $('hubConfirm').disabled=!!error;$('hubConfirm').textContent=this.mode==='site'?'Continue building →':`Place · ${catalog[this.tool].price.toLocaleString()} ◇`;$('hubRotate').hidden=this.mode==='site';
  }
  this.preview();
 },
 confirm(){if(!this.selected)return;const error=this.error(this.selected);if(error){this.message(error);return;}const{q,r}=this.selected;
  if(this.mode==='site'){const error=Store.reserve(this.index,q,r);if(error){this.message(error);return;}Contract.index=this.index;this.hide();Contract.start();}
  else {const result=Store.buy(this.tool,q,r,this.rotation);if(!result.ok){this.message(result.error);return;}this.world.rebuild(Store.data.city);this.selected=null;this.hover=null;this.render();this.message(`${catalog[this.tool].name} placed · ${catalog[this.tool].price.toLocaleString()} coins spent · saved.`);}
 },
 cancel(){this.selected=null;this.hover=null;this.render();this.message('Preview cancelled. No coins spent.');},
 tick(dt){if(!this.world)return;const now=performance.now();const elapsed=this.lastFrame?Math.min((now-this.lastFrame)/1000,1):0;this.lastFrame=now;if(!document.hidden)Store.data.city.elapsed+=elapsed;this.world.tick(matchMedia('(prefers-reduced-motion: reduce)').matches?0:Store.data.city.elapsed);this.clock+=dt;if(this.clock>1){this.clock=0;const c=this.world.counts();$('hubLife').textContent=`${Object.keys(Store.data.city.tiles).length} hexes · ${c.residents} neighbors · ${c.fish} pond fish`;if($('hubMoney').textContent!==Store.data.coins.toLocaleString())this.render();}},
};
