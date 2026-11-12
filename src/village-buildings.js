import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {OBJLoader} from 'three/examples/jsm/loaders/OBJLoader.js';
// The exact house/workshop family from the standalone city prototype.
const lin=c=>new THREE.Color(c).convertSRGBToLinear();
const mat=(c,extra={})=>new THREE.MeshStandardMaterial({color:lin(c),roughness:.84,...extra});
const M={grass:mat('#8ba76c'),earth:mat('#6b6655'),rock:mat('#53584c'),stone:mat('#b7baa1'),path:mat('#b3b59a'),wood:mat('#796048'),dark:mat('#384d49'),soil:mat('#524737'),gold:mat('#edc580'),glow:mat('#ffe0a2',{emissive:lin('#ffbb55'),emissiveIntensity:1.8}),wall:mat('#aaa38a'),leaf:mat('#77985c')};
const protos={};let balcony;
function mesh(parent,geo,material,x=0,y=0,z=0){const o=new THREE.Mesh(geo,material);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
function box(p,x,y,z,w,h,d,m){return mesh(p,new THREE.BoxGeometry(w,h,d),m,x,y,z);}
function cylinder(p,x,y,z,r,h,m,n=6,r2=r){return mesh(p,new THREE.CylinderGeometry(r,r2,h,n),m,x,y,z);}
function prop(parent,name,x,z,width,y=0,rotation=0){
 const proto=protos[name];if(!proto)return null;
 const o=proto.clone(true);o.position.set(0,0,0);o.rotation.set(0,0,0);o.scale.setScalar(1);o.updateMatrixWorld(true);
 const b=new THREE.Box3().setFromObject(o),size=b.getSize(new THREE.Vector3()),center=b.getCenter(new THREE.Vector3());
 const s=width/Math.max(size.x,size.z);o.scale.setScalar(s);o.position.set(-center.x*s,-b.min.y*s,-center.z*s);
 const g=new THREE.Group();g.add(o);g.position.set(x,y,z);g.rotation.y=rotation;parent.add(g);return g;
}
function lamp(p,x,z,y=0){box(p,x,y+.42,z,.07,.84,.07,M.wood);box(p,x,y+.9,z,.2,.3,.2,M.glow);box(p,x,y+1.08,z,.3,.07,.3,M.dark);box(p,x,y+.73,z,.27,.06,.27,M.dark);}
function flowers(g,x,z,size=.55,y=0){prop(g,'Flower_3_Group',x,z,size,y);prop(g,'Grass_Wispy_Short',x+.19,z-.17,size*.7,y);}
function planter(g,x,z,w=.65,y=1.19){box(g,x,y+.1,z,w,.2,.35,M.wood);box(g,x,y+.205,z,w-.07,.02,.28,M.soil);prop(g,'Bush_Common_Flowers',x,z,w*.95,y+.21);}
function terrace(g,garden){
 box(g,0,.58,.82,1.9,1.16,1.12,M.wall);box(g,0,1.19,.82,2.04,.12,1.25,M.stone);
 // The hand-crafted MegaKit railing is recolored to match the existing timber palette.
 if(balcony){for(const [x,z,rot,width] of [[0,1.44,0,1.98],[-1,.83,Math.PI/2,1.2],[1,.83,Math.PI/2,1.2]]){
 const o=balcony.clone(true),b=new THREE.Box3().setFromObject(o),s=width/(b.max.x-b.min.x);o.scale.set(s,.38/(b.max.y-b.min.y),s);o.position.set(-(b.min.x+b.max.x)*s/2,-b.min.y*.38/(b.max.y-b.min.y),-(b.min.z+b.max.z)*s/2);
 const a=new THREE.Group();a.add(o);a.position.set(x,1.25,z);a.rotation.y=rot;g.add(a);
 }}
 box(g,0,.53,1.39,.36,.78,.03,M.dark);box(g,0,.69,1.413,.24,.4,.03,M.glow);
 if(garden){planter(g,-.58,1.1);planter(g,.58,1.1);planter(g,0,.48,.7);prop(g,'CommonTree_3',-.55,.52,.7,1.25);flowers(g,.6,.6,.4,1.25);box(g,0,1.28,1.16,.32,.06,.27,M.wood);}
}
function building(g,type,rotation,garden,variant=0){
 const b=new THREE.Group();g.add(b);b.rotation.y=rotation*Math.PI/3;
 if(type==='atelier'){prop(b,'House_3',0,-.45,2.25);terrace(b,garden);}
 else {prop(b,variant>1?'House_2':'House_1',0,-.12,2.65);prop(b,'Barrel',1,.65,.32);flowers(b,-.9,.94,.48);}
 // Warm ground-floor lanterns frame the entry; upper windows use the asset's framed geometry.
 lamp(b,-.95,1.1);lamp(b,.95,1.1);
 box(b,0,.03,1.5,.75,.06,.7,M.path);
}

let loaded=false;
const loader=new GLTFLoader();loader.setMeshoptDecoder(MeshoptDecoder);
export const villageReady=Promise.all([loader.loadAsync(import.meta.env.BASE_URL+'models/scenery.glb'),new OBJLoader().loadAsync(import.meta.env.BASE_URL+'models/city/Balcony_Cross_Straight.obj')]).then(([gltf,rail])=>{
 gltf.scene.traverse(o=>{if(o.isMesh){o.geometry.userData.shared=true;for(const m of Array.isArray(o.material)?o.material:[o.material]){m.roughness=.85;m.metalness=0;if(m.name==='Windows'){m.emissive=lin('#ffc26b');m.emissiveIntensity=.85;}}}});
 gltf.scene.children.forEach(o=>protos[o.name]=o);balcony=rail;rail.traverse(o=>{if(o.isMesh){o.geometry.userData.shared=true;o.material=M.wood;}});loaded=true;
});
// Keep startup responsive while reporting asset failure through the game's existing loader.
villageReady.catch(()=>{});
export function makeBuilding(cells,plan,options={}){
 const group=new THREE.Group(),keys=new Set(cells.map(c=>c.join(',')));
 const xs=cells.map(c=>c[0]),zs=cells.map(c=>c[2]),height=Math.max(...cells.map(c=>c[1]+1));
 const cx=(Math.min(...xs)+Math.max(...xs))/2,cz=(Math.min(...zs)+Math.max(...zs))/2;
 const width=Math.max(...xs)-Math.min(...xs)+1,depth=Math.max(...zs)-Math.min(...zs)+1;
 let progress=0,maxY=height,footprint=Math.max(width,depth),dead=false;const materials=new Set();
 const clip=new THREE.Plane(new THREE.Vector3(0,-1,0),0);
 function populate(){
  if(dead)return;
  const raw=new THREE.Group();const type=plan.index===1?'atelier':'cottage';
  building(raw,type,0,!!options.garden,plan.index===2?2:0);
  if(options.garden&&type!=='atelier'){
   // A supported terrace annex keeps the prototype's pitched roof intact.
   const annex=new THREE.Group();annex.scale.setScalar(.68);annex.position.set(0,0,.55);raw.add(annex);terrace(annex,true);
  }
  raw.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(raw),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const scale=Math.min(width/size.x,depth/size.z,(height+1.5)/size.y);
  raw.scale.setScalar(scale);raw.position.set(cx-center.x*scale,-bounds.min.y*scale,cz-center.z*scale);
  raw.traverse(o=>{if(!o.isMesh)return;const clone=m=>{const c=m.clone();c.clippingPlanes=progress>=1?null:[clip];materials.add(c);return c;};o.material=Array.isArray(o.material)?o.material.map(clone):clone(o.material);});
  maxY=size.y*scale;footprint=Math.max(size.x,size.z)*scale;group.add(raw);group.userData.architecture=['lantern-house','garden-atelier','courtyard-house'][plan.index];group.userData.asset=plan.index===1?'House_3':plan.index===2?'House_2':'House_1';reveal(progress);
 }
 function reveal(t){progress=t;clip.constant=-.2+t*(maxY+.8);for(const m of materials){const complete=t>=1;if(complete&&m.clippingPlanes){m.clippingPlanes=null;m.needsUpdate=true;}}}
 const ready=loaded?(populate(),Promise.resolve()):villageReady.then(populate);
 return {group,keys,get maxY(){return maxY;},get footprint(){return footprint;},ready,reveal,dispose(){dead=true;materials.forEach(m=>m.dispose());group.traverse(o=>{if(o.geometry&&!o.geometry.userData.shared)o.geometry.dispose();});}};
}
