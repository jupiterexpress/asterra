// A version-1 save produced with the unchanged, pre-wear store API. Grades are
// deliberate visual-test inputs; this is not a claim that D completes a contract.
import {writeFileSync} from 'node:fs';
import {createStore,SAVE_KEY} from '../../shared/store.js';import {CONTRACTS} from '../../src/blueprints.js';
const memory=new Map(),store=createStore({getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)});
store.profile('name','Wear verification');store.profile('opening',true);store.profile('tutorial',true);
for(const [index,site,grade] of [[0,[0,1],'A+'],[1,[-1,1],'C'],[2,[0,-1],'D']]){const error=store.reserve(index,...site);if(error)throw Error(error);store.complete(index,{complete:true,cells:CONTRACTS[index].cells,grade,reward:0});}
// Existing optional tile fields only; two gardens and another road lantern.
store.data.city.tiles['0,1'].garden=true;store.data.city.tiles['-1,1'].garden=true;Object.assign(store.data.city.tiles['1,0'],{kind:'road',lantern:true});store.save();
writeFileSync(new URL('./legacy-save.json',import.meta.url),memory.get(SAVE_KEY)+'\n');
