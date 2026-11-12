// Pure hex-grid rules shared by the hub and persistent store.
export const RADIUS=2.2;
export const DIRECTIONS=[[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]];
export const key=(q,r)=>`${q},${r}`;
export const position=(q,r)=>[Math.sqrt(3)*RADIUS*(q+r/2),1.5*RADIUS*r];
export const catalog={
 land:{name:'Meadow hex',price:500,icon:'⬡',description:'Expand onto a connected vacant hex. 500 coins per hex.'},
 path:{name:'Stone path',price:200,icon:'⋯',description:'A narrow stone path. Connections update with neighboring routes and buildings. 200 per hex.'},
 road:{name:'Village road',price:250,icon:'═',description:'A wider paved route through the quarter. 250 coins per hex.'},
 pond:{name:'Moonwater pond',price:1000,icon:'≈',description:'Turquoise water, reeds, and fish that arrive over time. 1,000 coins per hex.'},
 bridge:{name:'Timber bridge',price:1200,icon:'╫',description:'Cross a pond between opposite dry landing hexes. Paths are optional. R rotates. 1,200 for the crossing.'},
 garden:{name:'Rooftop garden',price:1500,icon:'❀',description:'Plant the flat, exposed roof cells of a completed building. 1,500 for the whole garden.'},
 grove:{name:'Wildflower grove',price:450,icon:'♧',description:'A woodland bench, flowers, shrubs, and varied trees. 450 per hex.'},
 lantern:{name:'Lantern pair',price:350,icon:'✧',description:'Two warm lights for a stone path or village road. 350 for the pair.'},
};
export const isRoute=t=>t&&(t.kind==='road'||t.kind==='path');
export const neighbors=(q,r)=>DIRECTIONS.map(([a,b])=>[q+a,r+b]);
export function initialState(){
 const tiles={};
 for(const [q,r] of [[0,0],[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1],[-2,0],[2,-1]])tiles[key(q,r)]={q,r,kind:null,born:0};
 tiles['0,0'].kind='pond';tiles['-1,0'].kind='path';tiles['-1,0'].lantern=true;tiles['1,-1'].kind='grove';
 return {money:1200,tiles,elapsed:0,purchases:0};
}
export function candidates(s){const all=new Map(Object.values(s.tiles).map(t=>[key(t.q,t.r),[t.q,t.r]]));for(const t of Object.values(s.tiles))for(const [q,r] of neighbors(t.q,t.r))if(Math.max(Math.abs(q),Math.abs(r),Math.abs(q+r))<=6)all.set(key(q,r),[q,r]);return [...all.values()];}
// Only exposed uppermost cells qualify: a planter stays inside its supporting cell.
export function roofCells(cells=[]){
 const top=new Map();for(const [x,y,z] of cells){const k=key(x,z);if(!top.has(k)||top.get(k)[1]<y)top.set(k,[x,y,z]);}
 return [...top.values()].filter(c=>c.every(Number.isFinite));
}
export function siteError(s,q,r){const t=s.tiles[key(q,r)];if(!t)return 'Expand the city onto this hex first.';if(t.kind)return 'Choose a vacant meadow for this contract.';if(t.reserved!==undefined)return 'This site already has a contract assigned.';return null;}
export function validate(s,tool,q,r,rotation=0){
 if(!catalog[tool])return 'Buildings are created through stacking contracts.';
 if(!Number.isInteger(q)||!Number.isInteger(r)||Math.max(Math.abs(q),Math.abs(r),Math.abs(q+r))>6)return 'Outside this quarter’s expansion boundary.';
 const t=s.tiles[key(q,r)];
 if(tool==='land'){if(t)return 'This hex already belongs to your city.';if(!neighbors(q,r).some(([a,b])=>s.tiles[key(a,b)]))return 'New terrain must touch the city.';}
 else {
  if(!t)return 'Add a meadow hex here first.';
  if(t.reserved!==undefined)return 'This hex is reserved for a stacking contract.';
  if(tool==='garden'){if(t.kind!=='building')return 'Finish a stacking contract to create a suitable building.';if(t.garden)return 'This rooftop is already planted.';if(roofCells(t.cells).length<2)return 'This rooftop needs at least two exposed flat roof cells.';}
  else if(tool==='lantern'){if(!isRoute(t))return 'Lanterns belong on paths and roads.';if(t.lantern)return 'This route already has lanterns.';}
  else if(tool==='bridge'){
   if(t.kind!=='pond')return 'A bridge must cross a pond.';if(t.bridge!==undefined)return 'This pond already has a bridge.';
   const [a,b]=DIRECTIONS[rotation%3];
   if(![1,-1].every(d=>{const n=s.tiles[key(q+a*d,r+b*d)];return n&&n.reserved===undefined&&(!n.kind||isRoute(n));}))return 'Rotate toward two opposite clear, dry landing hexes. Paths are optional.';
  } else if(t.kind)return 'This hex is occupied. Choose an empty meadow.';
  // Landings remain clear unless replaced by a connecting path or road.
  if(!['road','path','garden','lantern','bridge'].includes(tool)&&Object.values(s.tiles).some(n=>n.bridge!==undefined&&[1,-1].some(d=>{const [a,b]=DIRECTIONS[n.bridge];return n.q+a*d===q&&n.r+b*d===r;})))return 'Keep this bridge landing clear, or add a path or road.';
 }
 if(s.money<catalog[tool].price)return `You need ${(catalog[tool].price-s.money).toLocaleString()} more coins. Earn them through stacking.`;
 return null;
}
export function isLanding(s,q,r){return Object.values(s.tiles).some(n=>n.bridge!==undefined&&[1,-1].some(d=>{const[a,b]=DIRECTIONS[n.bridge];return n.q+a*d===q&&n.r+b*d===r;}));}
export function purchase(s,tool,q,r,rotation=0){const error=validate(s,tool,q,r,rotation);if(error)return {ok:false,error};if(tool==='land')s.tiles[key(q,r)]={q,r,kind:null,born:s.elapsed};else{const t=s.tiles[key(q,r)];if(tool==='garden'||tool==='lantern')t[tool]=true;else if(tool==='bridge')t.bridge=rotation%3;else Object.assign(t,{kind:tool,born:s.elapsed,rotation:rotation%6});}s.money-=catalog[tool].price;s.purchases++;return {ok:true};}
export function connectedHomes(s){return Object.values(s.tiles).filter(t=>t.kind==='building'&&neighbors(t.q,t.r).some(([q,r])=>isRoute(s.tiles[key(q,r)])));}
