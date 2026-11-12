import {initialState,purchase,siteError,isLanding,key} from '../city/state.js';
import {defaultSettings,normalizeSettings} from './settings.js';
export const SAVE_KEY='asterra-integrated-v1';
export function freshSave(){const city=initialState();return {version:1,coins:city.money,nextIndex:0,completed:[],city,profile:{name:'',opening:false,tutorial:false},settings:defaultSettings(),activeRun:null};}
export function createStore(storage){
 let data=freshSave(),warning='';
 try{const raw=storage?.getItem(SAVE_KEY);if(raw){const saved=JSON.parse(raw);if(saved.version!==1||!saved.city?.tiles||!Array.isArray(saved.completed)||!Number.isFinite(saved.coins))throw Error('Invalid save');data=saved;data.settings=normalizeSettings(saved.settings);}}catch{warning='The saved game could not be read. This session starts fresh; export or reset before replacing the old save.';}
 const store={
  get data(){return data;},get warning(){return warning;},
  save(){data.city.money=data.coins;try{if(!warning)storage?.setItem(SAVE_KEY,JSON.stringify(data));}catch{warning='Saving is unavailable. Keep this tab open to retain this session.';}},
  profile(field,value){data.profile[field]=value;this.save();},
  buy(tool,q,r,rotation=0){data.city.money=data.coins;const result=purchase(data.city,tool,q,r,rotation);if(result.ok){data.coins=data.city.money;this.save();}return result;},
  reserve(index,q,r){
   if(index!==data.nextIndex||data.completed[index])return 'This contract is locked or already complete.';
   const error=siteError(data.city,q,r);if(error)return error;if(isLanding(data.city,q,r))return 'Keep this bridge landing clear; choose another building site.';
   this.abort();data.city.tiles[key(q,r)].reserved=index;data.activeRun={index,q,r,baseline:data.coins};this.save();return null;
  },
  begin(index){return !!data.activeRun&&data.activeRun.index===index&&!data.completed[index];},
  addCoins(amount){data.coins=Math.max(0,data.coins+Math.round(amount));this.save();},
  queueResult(index,result){if(data.activeRun?.index===index&&result.complete){data.activeRun.result=structuredClone(result);this.save();}},
  complete(index,result){
   const run=data.activeRun;if(!run||run.index!==index||data.completed[index]||!result.complete)return false;
   const tile=data.city.tiles[key(run.q,run.r)];if(!tile||tile.reserved!==index)return false;
   Object.assign(tile,{kind:'building',contract:index,cells:structuredClone(result.cells),grade:result.grade,born:data.city.elapsed});delete tile.reserved;
   data.completed[index]={cells:structuredClone(result.cells),grade:result.grade,site:[run.q,run.r],reward:result.reward};
   data.nextIndex=Math.max(data.nextIndex,index+1);data.coins+=result.reward;data.activeRun=null;this.save();return true;
  },
  restart(){const run=data.activeRun;if(!run)return;delete run.result;this.save();},
  abort(){const run=data.activeRun;if(!run)return;if(run.result?.complete){this.complete(run.index,run.result);return;}const tile=data.city.tiles[key(run.q,run.r)];if(tile)delete tile.reserved;data.activeRun=null;this.save();},
  recover(){this.abort();},
  reset(){data=freshSave();warning='';this.save();},
 };
 return store;
}
let storage;try{storage=globalThis.localStorage;}catch{}
export const Store=createStore(storage);
