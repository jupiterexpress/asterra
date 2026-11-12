import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RADIUS, DIRECTIONS, position, key, candidates, connectedHomes, isRoute, roofCells } from './state.js';
import {makeBuilding} from '../src/building.js';
import {villageReady} from '../src/village-buildings.js';
import {CONTRACTS} from '../src/blueprints.js';
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
function playerBuilding(g,t){
 const b=makeBuilding(t.cells,CONTRACTS[t.contract],{garden:!!t.garden});b.reveal(1);
 const xs=t.cells.map(c=>c[0]),zs=t.cells.map(c=>c[2]);
 const cx=(Math.min(...xs)+Math.max(...xs))/2,cz=(Math.min(...zs)+Math.max(...zs))/2;
 const scale=3.15/b.footprint;
 const model=new THREE.Group();model.scale.setScalar(scale);g.add(model);
 b.group.position.set(-cx,0,-cz);model.add(b.group);b.group.userData.dispose=b.dispose;
 b.group.name='built-'+t.contract;b.group.userData.cellKeys=[...b.keys];

 lamp(g,-1.35,1);flowers(g,1.15,.85,.55);
}
function bridge(g,axis){
 const b=new THREE.Group();b.rotation.y=-axis*Math.PI/3;g.add(b);const length=Math.sqrt(3)*RADIUS;
 for(let i=0;i<19;i++){const x=-length/2+(i+.5)*length/19;const y=.13+.28*Math.sin((i+.5)/19*Math.PI);box(b,x,y,0,length/19-.014,.1,.85,M.wood);}
 for(const side of [-1,1]){
 for(let i=0;i<=6;i++){const x=-length/2+i*length/6,y=.13+.28*Math.sin(i/6*Math.PI);box(b,x,y+.25,side*.48,.065,.6,.065,M.dark);}
 for(let i=0;i<6;i++){const a=-length/2+i*length/6,c=a+length/6,y1=.13+.28*Math.sin(i/6*Math.PI),y2=.13+.28*Math.sin((i+1)/6*Math.PI);const rail=box(b,(a+c)/2,(y1+y2)/2+.53,side*.48,Math.hypot(c-a,y2-y1),.065,.07,M.wood);rail.rotation.z=Math.atan2(y2-y1,c-a);}
 for(const x of [-1.35,1.35])box(b,x,-.02,side*.35,.13,.5,.13,M.dark);
 }
}
const waterTime={value:0};
const waterMat=new THREE.ShaderMaterial({transparent:true,uniforms:{time:waterTime},vertexShader:`varying vec3 p; varying vec3 world; void main(){p=position;world=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform float time;varying vec3 p;varying vec3 world;void main(){float wave=sin(p.x*7.+time*.8+p.z*3.)*.5+sin(p.z*10.-time*.65)*.25;float edge=smoothstep(1.35,1.76,length(p.xz));vec3 n=normalize(vec3(.07*cos(p.x*7.+time*.8),1.,.06*cos(p.z*10.-time*.65)));vec3 v=normalize(cameraPosition-world);float f=pow(1.-max(dot(n,v),0.),3.);vec3 c=mix(vec3(.055,.44,.43),vec3(.35,.77,.66),edge*.65+wave*.06);c=mix(c,vec3(.75,.84,.72),f*.65);float glint=pow(max(dot(reflect(-normalize(vec3(-.4,1.,.6)),n),v),0.),70.);c+=vec3(.65,.65,.43)*glint*.5;float ripple=smoothstep(.96,1.,sin(length(p.xz)*20.-time));c+=vec3(.19,.33,.27)*ripple*.16;gl_FragColor=vec4(c,.88);}`,side:THREE.DoubleSide});
function pond(g){
 cylinder(g,0,-.07,0,1.85,.12,M.stone,12);
 const geo=new THREE.CircleGeometry(1.73,48);geo.rotateX(-Math.PI/2);const water=mesh(g,geo,waterMat,0,.015,0);water.castShadow=false;
 for(let i=0;i<12;i++){const a=i*Math.PI/6;prop(g,i%2?'Pebble_Round_1':'Pebble_Round_3',Math.cos(a)*1.82,Math.sin(a)*1.82,.28+(i%3)*.08,.015,a);}
 for(const [x,z] of [[1.3,.95],[-1.25,-1]])prop(g,'Grass_Common_Tall',x,z,.43,.03);
 for(const [x,z] of [[.9,.6],[-1,-.5]]){const lily=cylinder(g,x,.035,z,.17,.018,M.leaf,9);flowers(g,x,z,.13,.04);}
}
function road(g,t,state){
 cylinder(g,0,.035,0,.48,.07,M.path,12);
 let connections=0;
 DIRECTIONS.forEach(([dq,dr],i)=>{const n=state.tiles[key(t.q+dq,t.r+dr)];
 const linked=n&&(isRoute(n)||n.kind==='building'||(n.kind==='pond'&&n.bridge!==undefined&&i%3===n.bridge));
 if(!linked)return;connections++;
 const [x,z]=position(dq,dr),len=Math.hypot(x,z)/2;
 const strip=box(g,x/4,.035,z/4,t.kind==='road'?.95:.58,.07,len,M.path);strip.rotation.y=Math.atan2(x,z);
 for(let j=1;j<5;j++){const f=j/5;const seam=box(g,x/2*f,.074,z/2*f,t.kind==='road'?.96:.59,.008,.025,M.stone);seam.rotation.y=Math.atan2(x,z);}
 });
 if(!connections)box(g,0,.035,0,.65,.07,1.9,M.path);
 if(t.lantern){lamp(g,-.9,.6);lamp(g,.9,-.6);flowers(g,-1.1,-.65,.5);}
}
function grove(g,q){prop(g,q<0?'CommonTree_2':'CommonTree_4',-.45,-.35,1.65);prop(g,'Pine_2',.7,-.6,.85);prop(g,'Bush_Common_Flowers',.7,.6,.85);prop(g,'Bench_1',-.55,.83,.85,0,-.35);flowers(g,-1,.25,.7);flowers(g,.1,1.18,.6);prop(g,'Mushroom_Common',-.2,-1.12,.28);}
function content(g,t,state){if(t.kind==='building')playerBuilding(g,t);if(t.kind==='grove')grove(g,t.q);if(isRoute(t))road(g,t,state);if(t.kind==='pond'){pond(g);if(t.bridge!==undefined)bridge(g,t.bridge);}}
function disposeGroup(g){g.traverse(o=>{o.userData.dispose?.();if(o.geometry&&!o.geometry.userData.shared)o.geometry.dispose();if(o.userData.ghostMaterial)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();});g.clear();}
export async function createWorld(canvas){
 await villageReady;
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.outputEncoding=THREE.sRGBEncoding;renderer.localClippingEnabled=true;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.1,160);
 scene.add(new THREE.HemisphereLight(0xffefcf,0x4c746b,.95));const sun=new THREE.DirectionalLight(0xffdfad,1.25);sun.position.set(-12,22,12);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-25,right:25,top:25,bottom:-25,near:1,far:70});sun.shadow.normalBias=.035;scene.add(sun);
 const fill=new THREE.DirectionalLight(0xa8d9df,.35);fill.position.set(8,6,-12);scene.add(fill);
 const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.enablePan=true;controls.minDistance=15;controls.maxDistance=60;controls.minPolarAngle=.35;controls.maxPolarAngle=1.25;controls.mouseButtons={LEFT:null,MIDDLE:THREE.MOUSE.PAN,RIGHT:THREE.MOUSE.ROTATE};
 const reset=()=>{camera.position.set(17,22,29).multiplyScalar(innerWidth<1050?1.25:1);controls.target.set(0,-.3,0);controls.update();};reset();
 const loader=new GLTFLoader();loader.setMeshoptDecoder(MeshoptDecoder);
 const [gltf,rail]=await Promise.all([loader.loadAsync(import.meta.env.BASE_URL+'models/scenery.glb'),new OBJLoader().loadAsync(import.meta.env.BASE_URL+'models/city/Balcony_Cross_Straight.obj')]);
 gltf.scene.traverse(o=>{if(o.isMesh){o.geometry.userData.shared=true;o.castShadow=true;o.receiveShadow=true;for(const m of Array.isArray(o.material)?o.material:[o.material]){m.metalness=0;m.roughness=.85;if(m.name==='Windows'){m.emissive=lin('#ffc26b');m.emissiveIntensity=.85;}}}});
 gltf.scene.children.forEach(o=>protos[o.name]=o);balcony=rail;balcony.traverse(o=>{if(o.isMesh){o.geometry.userData.shared=true;o.material=M.wood;o.castShadow=true;}});
 const root=new THREE.Group(),guides=new THREE.Group(),ghost=new THREE.Group(),life=new THREE.Group();scene.add(root,guides,ghost,life);
 const targets=[],fish=[],people=[];let state;
 function rebuild(s){state=s;renderer.shadowMap.needsUpdate=true;disposeGroup(root);disposeGroup(guides);disposeGroup(life);targets.length=0;fish.length=0;people.length=0;
 for(const t of Object.values(s.tiles)){
 const [x,z]=position(t.q,t.r),g=new THREE.Group();g.position.set(x,0,z);root.add(g);
 cylinder(g,0,-.275,0,RADIUS-.025,.37,M.earth,6);cylinder(g,0,-.045,0,RADIUS-.025,.09,M.grass,6);
 const depth=1.3+((t.q*7+t.r*11+30)%4)*.25;cylinder(g,0,-.46-depth/2,0,RADIUS-.035,depth,M.rock,6,.65);
 content(g,t,s);
 if(!t.kind){flowers(g,-1.35,-.35,.5);prop(g,'Grass_Common_Short',1.15,.7,.55);prop(g,'Pebble_Round_3',-.4,-1.4,.28);}
 if(t.kind==='pond')for(let i=0;i<4;i++){
 const f=new THREE.Group();const body=mesh(f,new THREE.SphereGeometry(.12,7,4),M.gold);body.scale.set(1.7,.45,.65);const tail=mesh(f,new THREE.ConeGeometry(.09,.16,3),M.gold,-.23,0,0);tail.rotation.z=Math.PI/2;life.add(f);fish.push({object:f,x,z,index:i,born:t.born});}
 }
 for(const [q,r] of candidates(s)){
 const [x,z]=position(q,r),existing=s.tiles[key(q,r)];
 const geo=new THREE.CircleGeometry(RADIUS-.03,6);geo.rotateZ(Math.PI/6);geo.rotateX(-Math.PI/2);
 const m=new THREE.MeshBasicMaterial({color:0xa9dbbb,transparent:true,opacity:existing?0:.075,depthWrite:false,side:THREE.DoubleSide});
 const target=mesh(guides,geo,m,x,.085,z);target.castShadow=false;target.receiveShadow=false;target.userData={q,r,ghostMaterial:true};targets.push(target);
 if(!existing){const line=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({length:6},(_,i)=>new THREE.Vector3(Math.sin(i*Math.PI/3)*(RADIUS-.09),.08,Math.cos(i*Math.PI/3)*(RADIUS-.09)))),new THREE.LineBasicMaterial({color:0xc3d7a7,transparent:true,opacity:.28}));line.position.set(x,0,z);line.userData.ghostMaterial=true;guides.add(line);}
 }
 life.traverse(o=>{o.castShadow=false;});
 const homes=connectedHomes(s);
 homes.slice(0,10).forEach((t,i)=>{const p=new THREE.Group();cylinder(p,0,.18,0,.11,.28,i%2?M.dark:M.gold,5);mesh(p,new THREE.IcosahedronGeometry(.12,0),M.wall,0,.41,0);life.add(p);const dest=DIRECTIONS.map(([a,b])=>s.tiles[key(t.q+a,t.r+b)]).find(n=>isRoute(n));p.traverse(o=>{o.castShadow=false;});people.push({object:p,home:t,dest,index:i});});
 }
 function preview(tool,q,r,rotation,valid){disposeGroup(ghost);if(q===undefined)return;
 const [x,z]=position(q,r);ghost.position.set(x,0,z);
 const ring=new THREE.Mesh(new THREE.RingGeometry(RADIUS-.14,RADIUS-.035,6),new THREE.MeshBasicMaterial({color:valid?0xf6d38c:0xf28c7d,transparent:true,opacity:.95,side:THREE.DoubleSide,depthTest:false}));ring.rotation.set(-Math.PI/2,0,Math.PI/6);ring.position.y=.12;ring.userData.ghostMaterial=true;ghost.add(ring);
 const g=new THREE.Group();ghost.add(g);
 if(tool==='land')cylinder(g,0,-.045,0,RADIUS-.05,.09,M.grass,6);
 else if(tool==='bridge')bridge(g,rotation%3);
 else if(tool==='garden'){const t=state.tiles[key(q,r)];if(t?.kind==='building')playerBuilding(g,{...t,garden:true});}
 else if(tool==='lantern'){lamp(g,-.9,.6);lamp(g,.9,-.6);}
 else if(tool==='site'){for(const [x,z] of [[-1,-1],[1,-1],[-1,1],[1,1]]){box(g,x,.25,z,.07,.5,.07,M.gold);}box(g,0,.03,0,2.4,.06,2.4,M.stone);}
 else content(g,{q,r,kind:tool,rotation,born:state.elapsed},state);
 g.traverse(o=>{if(o.isMesh){const originals=Array.isArray(o.material)?o.material:[o.material];o.material=originals.map(m=>new THREE.MeshBasicMaterial({color:valid?0xb5e3b3:0xf07d70,map:m.map||null,transparent:true,opacity:.5,depthWrite:false}));if(o.material.length===1)o.material=o.material[0];o.userData.ghostMaterial=true;o.castShadow=false;}});
 }
 const raycaster=new THREE.Raycaster();
 function pick(clientX,clientY){const rect=canvas.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1),camera);return raycaster.intersectObjects(targets)[0]?.object.userData;}
 function screen(q,r){const [x,z]=position(q,r);const p=new THREE.Vector3(x,.09,z).project(camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};}
 function tick(time){waterTime.value=time;controls.update();
 fish.forEach(f=>{const age=state.elapsed-f.born;f.object.visible=age>5+f.index*5;const a=time*.25+f.index*1.7;f.object.position.set(f.x+Math.cos(a)*(1.05-f.index*.12),.04,f.z+Math.sin(a)*(.7+f.index*.05));f.object.rotation.y=-a-Math.PI/2;});
 people.forEach(p=>{p.object.visible=state.elapsed-p.home.born>9+p.index*8;if(!p.dest)return;const [x,z]=position(p.dest.q,p.dest.r),[hx,hz]=position(p.home.q,p.home.r);const k=(Math.sin(time*.25+p.index)+1)*.32;p.object.position.set(x+(hx-x)*k,.085+Math.abs(Math.sin(time*3))*.025,z+(hz-z)*k);p.object.rotation.y=Math.atan2(hx-x,hz-z);});renderer.render(scene,camera);
 }
 const resize=()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.setViewOffset(innerWidth,innerHeight,innerWidth<1050?100:35,0,innerWidth,innerHeight);camera.updateProjectionMatrix();};addEventListener('resize',resize);resize();
 return {rebuild,preview,pick,screen,tick,reset,renderer,focus:(q,r)=>{const[x,z]=position(q,r);const delta=new THREE.Vector3(x,0,z).sub(controls.target);camera.position.add(delta);controls.target.add(delta);controls.update();},buildingKeys:()=>{const out={};root.traverse(o=>{if(o.userData.cellKeys)out[o.name]=o.userData.cellKeys;});return out;},counts:()=>({fish:fish.filter(f=>f.object.visible).length,residents:people.filter(p=>p.object.visible).length})};
}
