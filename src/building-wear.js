import * as THREE from 'three';
import {BufferGeometryUtils} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {wearForGrade} from './wear-config.js';
// All artistic dimensions, counts, colors and thresholds in this module are PLACEHOLDER.
// Geometry/topology constants (triangles, coordinates, normalization) are not gameplay rules.
const color=c=>new THREE.Color(c).convertSRGBToLinear();
const material=(c,extra={})=>new THREE.MeshStandardMaterial({color:color(c),roughness:.9,...extra});
export function decodedGeometry(source){
 const g=new THREE.BufferGeometry();
 for(const [name,a] of Object.entries(source.attributes)){
  const values=new Float32Array(a.count*a.itemSize);
  const divisor=a.normalized?({Int8Array:127,Uint8Array:255,Int16Array:32767,Uint16Array:65535}[a.array.constructor.name]||1):1;
  for(let i=0;i<a.count;i++)for(let j=0;j<a.itemSize;j++)values[i*a.itemSize+j]=Math.max(a.normalized?-1:-Infinity,a[['getX','getY','getZ','getW'][j]](i)/divisor);
  g.setAttribute(name,new THREE.BufferAttribute(values,a.itemSize));
 }
 if(source.index)g.setIndex(source.index.clone());return g;
}
// Weld coincident triangle vertices before finding disconnected panes/tiles. UV seams
// and split normals in the compressed source must not turn one pane into many pieces.
export function splitComponents(source){
 const g=decodedGeometry(source),p=g.attributes.position,ids=g.index?Array.from(g.index.array):Array.from({length:p.count},(_,i)=>i),parent=Array.from({length:p.count},(_,i)=>i),weld=new Map();
 const root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
 const join=(a,b)=>parent[root(a)]=root(b);
 for(let i=0;i<p.count;i++){const k=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*100000)).join(',');if(weld.has(k))join(i,weld.get(k));else weld.set(k,i);}
 for(let i=0;i<ids.length;i+=3){join(ids[i],ids[i+1]);join(ids[i],ids[i+2]);}
 const parts=new Map();for(let i=0;i<ids.length;i+=3){const r=root(ids[i]);if(!parts.has(r))parts.set(r,[]);parts.get(r).push(...ids.slice(i,i+3));}
 const result=[...parts.values()].map(indices=>{const part=new THREE.BufferGeometry();for(const [name,a] of Object.entries(g.attributes)){const values=indices.flatMap(i=>Array.from(a.array.slice(i*a.itemSize,(i+1)*a.itemSize)));part.setAttribute(name,new THREE.Float32BufferAttribute(values,a.itemSize));}part.computeBoundingBox();return part;});g.dispose();return result;
}
// Source windows are continuous glass behind timber mullions. Cut each window
// into quadrants along those mullions so a missing pane leaves the frame intact.
function splitPanes(windowGeometry){
 const g=windowGeometry,b=g.boundingBox,size=b.getSize(new THREE.Vector3()),axis=size.x<size.z?2:0,center=b.getCenter(new THREE.Vector3()),out=[];
 for(const sx of [-1,1])for(const sy of [-1,1]){
  const arrays=Object.fromEntries(Object.keys(g.attributes).map(k=>[k,[]]));
  for(let i=0;i<g.attributes.position.count;i+=3){
   let polygon=[0,1,2].map(j=>Object.fromEntries(Object.entries(g.attributes).map(([k,a])=>[k,Array.from(a.array.slice((i+j)*a.itemSize,(i+j+1)*a.itemSize))])));
   for(const [a,c,sign] of [[axis,center.getComponent(axis),sx],[1,center.y,sy]]){
    const clipped=[];for(let j=0;j<polygon.length;j++){const v=polygon[j],n=polygon[(j+1)%polygon.length],d=(v.position[a]-c)*sign,e=(n.position[a]-c)*sign;if(d>=0)clipped.push(v);if((d<0)!==(e<0)){const t=d/(d-e);clipped.push(Object.fromEntries(Object.keys(v).map(k=>[k,v[k].map((x,l)=>x+(n[k][l]-x)*t)])));}}polygon=clipped;
   }
   for(let j=1;j<polygon.length-1;j++)for(const v of [polygon[0],polygon[j],polygon[j+1]])for(const k of Object.keys(arrays))arrays[k].push(...v[k]);
  }
  if(arrays.position.length){const part=new THREE.BufferGeometry();for(const [k,a] of Object.entries(arrays))part.setAttribute(k,new THREE.Float32BufferAttribute(a,g.attributes[k].itemSize));part.computeBoundingBox();out.push(part);}
 }g.dispose();return out;
}
function crackTexture(kind='pane'){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d');
 c.lineCap='round';c.lineJoin='round';
 const line=(points,width,stroke)=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.lineWidth=width;c.strokeStyle=stroke;c.stroke();};
 if(kind==='pane'){
  const paths=[[[118,102],[79,65],[68,9]],[[118,102],[160,76],[208,26]],[[118,102],[133,154],[118,211],[141,256]],[[118,102],[61,132],[0,123]],[[133,154],[192,174],[244,226]],[[79,65],[17,44]],[[192,174],[217,146]]];
  for(const path of paths){line(path,5,'rgba(255,240,202,.75)');line(path,2.5,'rgba(43,48,43,.94)');}
 }
 const texture=new THREE.CanvasTexture(canvas);texture.userData={wearTexture:true};return texture;
}
function paneUV(g){const p=g.attributes.position;g.computeBoundingBox();const size=g.boundingBox.getSize(new THREE.Vector3());const axes=size.x<size.z?['z','y']:['x','y'];const uv=[];for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i);uv.push((v[axes[0]]-g.boundingBox.min[axes[0]])/(size[axes[0]]||1),(v.y-g.boundingBox.min.y)/(size.y||1));}g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));return g;}
function addBox(parent,size,position,m){const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),m);mesh.position.set(...position);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
export function prepareWorkshop(house){
 // The source stone workshop has no glass. Recessed framed panes on its two side
 // walls give it real per-pane surfaces; they stay on the house, never the annex.
 const bounds=new THREE.Box3().setFromObject(house),size=bounds.getSize(new THREE.Vector3());
 // Bounds are converted to the prop's local coordinates (before final building fit).
 house.updateMatrixWorld(true);const local=bounds.clone().applyMatrix4(house.matrixWorld.clone().invert());const w=local.getSize(new THREE.Vector3()),c=local.getCenter(new THREE.Vector3());
 const roof=material('#315c5c');roof.name='RoofTiles';
 for(let x=0;x<5;x++)for(let z=0;z<5;z++)addBox(house,[w.x/5-.004,.035,w.z/5-.004],[local.min.x+(x+.5)*w.x/5,local.max.y+.015,local.min.z+(z+.5)*w.z/5],roof);
 const glass=material('#efcf91',{emissive:color('#ffc26b'),emissiveIntensity:.85});glass.name='Windows';
 for(const side of [-1,1])for(const z of [-.22,.22]){
  const frame=addBox(house,[.045,.48,.34],[c.x+side*(w.x/2+.01),local.min.y+w.y*.63,c.z+z*w.z],material('#594735'));
  const pane=addBox(house,[.018,.36,.23],[frame.position.x+side*.028,frame.position.y,frame.position.z],glass);pane.name='workshop-pane';
 }
}
function wallTexture(wear,anchor){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const c=canvas.getContext('2d');
 const x=Math.min(.88,(anchor?.x??.59)+.07),top=wear>=.85?.96:wear>=.6?(anchor?.y??.69):.53,bottom=wear>=.85?.04:wear>=.6?.13:.36;
 if(wear>=.6){for(const [cx,cy,r] of [[x,anchor?.y??.69,.2],[.2,.75,.12]]){const g=c.createRadialGradient(cx*512,(1-cy)*512,0,cx*512,(1-cy)*512,r*512);g.addColorStop(0,'rgba(43,37,30,.55)');g.addColorStop(1,'rgba(43,37,30,0)');c.fillStyle=g;c.fillRect(0,0,512,512);}}
 c.strokeStyle='rgba(48,42,33,.8)';c.lineWidth=wear>=.85?2.8:wear>=.6?2:1.2;c.lineJoin='round';c.beginPath();
 const points=[];for(let i=0;i<=9;i++){const px=x+[0,.015,-.012,.025,.005,.04,.02,.035,.01,.025][i],py=top-(top-bottom)*i/9;points.push([px*512,(1-py)*512]);i?c.lineTo(...points[i]):c.moveTo(...points[i]);}c.stroke();
 for(const i of [3,6]){c.beginPath();c.moveTo(...points[i]);c.lineTo(points[i][0]-17,points[i][1]+10);c.lineTo(points[i][0]-27,points[i][1]+24);c.stroke();}
 const texture=new THREE.CanvasTexture(canvas);texture.userData={wearTexture:true};return texture;
}
function applyWalls(house,wear,stats){
 stats.wallCracks=0;stats.soot=wear>=.6;if(wear<.15)return;
 house.updateMatrixWorld(true);const inverse=house.matrixWorld.clone().invert(),bounds=new THREE.Box3().setFromObject(house).applyMatrix4(inverse),size=bounds.getSize(new THREE.Vector3());
 const walls=[],windows=[];house.traverse(o=>{if(!o.isMesh)return;if(['Plaster','Stone_Dark','Stone','Stone_Light'].includes(o.material.name))walls.push(o);if(o.material.name==='Windows'){const b=new THREE.Box3().setFromObject(o).applyMatrix4(inverse);windows.push(b.getCenter(new THREE.Vector3()));}});
 for(const axis of (wear>=.35?['z','x']:['z'])){
  const u=axis==='z'?'x':'z',pane=windows.slice().sort((a,b)=>b[axis]-a[axis])[0],anchor=pane?{x:(pane[u]-bounds.min[u])/size[u],y:(pane.y-bounds.min.y)/size.y}:null;
  const m=new THREE.MeshBasicMaterial({map:wallTexture(wear,anchor),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  let faces=0;
  for(const source of walls){
   const g=decodedGeometry(source.geometry),p=g.attributes.position,index=g.index?Array.from(g.index.array):Array.from({length:p.count},(_,i)=>i),positions=[],uv=[],transform=inverse.clone().multiply(source.matrixWorld);
   for(let i=0;i<index.length;i+=3){const local=index.slice(i,i+3).map(j=>new THREE.Vector3().fromBufferAttribute(p,j)),world=local.map(v=>v.clone().applyMatrix4(transform)),normal=world[1].clone().sub(world[0]).cross(world[2].clone().sub(world[0])).normalize();if(normal[axis]<.8)continue;
    for(let j=0;j<3;j++){positions.push(...local[j].toArray());uv.push((world[j][u]-bounds.min[u])/size[u],(world[j].y-bounds.min.y)/size.y);}faces++;
   }g.dispose();if(!positions.length)continue;
   const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));const overlay=new THREE.Mesh(geometry,m);overlay.name='wear-wall-'+axis;source.add(overlay);
  }if(faces)stats.wallCracks++;else{m.map.dispose();m.dispose();}
 }
}
function applyRoof(house,wear,stats){
 stats.looseTiles=0;stats.missingTiles=0;stats.sag=false;if(wear<.35)return;
 const sources=[];house.traverse(o=>{if(o.isMesh&&o.material.name==='RoofTiles')sources.push(o);});house.updateMatrixWorld(true);
 const tiles=[];
 for(const source of sources){for(const g of splitComponents(source.geometry)){const c=g.boundingBox.getCenter(new THREE.Vector3()),world=c.clone().applyMatrix4(source.matrixWorld);tiles.push({g,c,world,source});}}
 // Choose genuine disconnected tiles, not arbitrary triangles cut out of the roof.
 tiles.sort((a,b)=>(b.world.x+b.world.z*.3)-(a.world.x+a.world.z*.3));
 const remove=wear>=.85?4:wear>=.6?1:0,kept=new Map();
 tiles.forEach(({g,c,source},i)=>{
  if(i>0&&i<=remove){g.dispose();stats.missingTiles++;return;}
  if(i===0){g.translate(-c.x,-c.y,-c.z);const loose=new THREE.Mesh(g,source.material);loose.position.copy(c);loose.position.y+=.025;loose.rotation.z=.14;loose.name='wear-loose-roof-tile';source.add(loose);stats.looseTiles++;}
  else {if(!kept.has(source))kept.set(source,[]);kept.get(source).push(g);}
 });
 for(const source of sources){const parts=kept.get(source)||[];const g=parts.length?BufferGeometryUtils.mergeBufferGeometries(parts):new THREE.BufferGeometry();parts.forEach(p=>p.dispose());source.geometry=g;}
 if(wear>=.6){
  const inverse=house.matrixWorld.clone().invert(),bounds=new THREE.Box3().setFromObject(house).applyMatrix4(inverse),size=bounds.getSize(new THREE.Vector3());
  house.traverse(o=>{if(!o.isMesh||!['RoofTiles','Wood','Wood_Side','Wood_Light'].includes(o.material.name)||!o.geometry.attributes.position)return;
   const g=decodedGeometry(o.geometry),p=g.attributes.position,toHouse=inverse.clone().multiply(o.matrixWorld),back=toHouse.clone().invert();
   for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(toHouse),height=(v.y-bounds.min.y)/size.y,edge=(v.x-bounds.min.x)/size.x;
    if(height>.52&&edge>.7){const along=(v.z-bounds.min.z)/size.z;v.y-=size.y*.018*Math.sin(Math.max(0,Math.min(1,along))*Math.PI)*(edge-.7)/.3;v.applyMatrix4(back);p.setXYZ(i,v.x,v.y,v.z);}
   }g.computeVertexNormals();g.computeBoundingBox();if(!o.geometry.userData.shared)o.geometry.dispose();o.geometry=g;
  });stats.sag=true;
 }
}
function boardPane(pane){
 const b=pane.geometry.boundingBox,size=b.getSize(new THREE.Vector3()),c=b.getCenter(new THREE.Vector3()),axis=size.x<size.z?'x':'z',width=axis==='x'?size.z:size.x,normal=new THREE.Vector3(axis==='x'?Math.sign(c.x)||1:0,0,axis==='z'?Math.sign(c.z)||1:0);
 const boards=new THREE.Group();boards.position.copy(c).addScaledVector(normal,.012);boards.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);pane.add(boards);
 for(const y of [-.22,.22]){const plank=addBox(boards,[width*1.1,size.y*.27,.018],[0,y*size.y,0],material('#77563b'));plank.rotation.z=y*.18;
  for(const x of [-.38,.38])addBox(plank,[.006,.006,.004],[x*width,0,.011],material('#323833'));
 }boards.name='wear-boarded-pane';
}
function chipCorner(house,stats){
 house.updateMatrixWorld(true);const inverse=house.matrixWorld.clone().invert(),stones=[];house.traverse(o=>{if(o.isMesh&&/^Stone/.test(o.material.name))stones.push(o);});
 const bounds=new THREE.Box3();stones.forEach(o=>bounds.union(new THREE.Box3().setFromObject(o).applyMatrix4(inverse)));const size=bounds.getSize(new THREE.Vector3()),radius=Math.min(size.x,size.z)*.13;let changed=0;
 const corners=[];for(const source of stones){const g=decodedGeometry(source.geometry),p=g.attributes.position,transform=inverse.clone().multiply(source.matrixWorld);for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(transform);if(v.y<bounds.min.y+size.y*.3)corners.push(v);}g.dispose();}
 const corner=corners.sort((a,b)=>(b.x*2+b.z)-(a.x*2+a.z)||a.y-b.y)[0];if(!corner){stats.chippedCorner=false;return;}

 for(const source of stones){const g=decodedGeometry(source.geometry),p=g.attributes.position,toHouse=inverse.clone().multiply(source.matrixWorld),back=toHouse.clone().invert();
  for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(toHouse),band=Math.max(0,1-Math.abs(v.y-corner.y)/(radius*1.5)),excess=v.x+v.z-(corner.x+corner.z-radius*band);
   if(excess>0){v.x-=excess*.5;v.z-=excess*.5;v.applyMatrix4(back);p.setXYZ(i,v.x,v.y,v.z);changed++;}
  }g.computeVertexNormals();g.computeBoundingBox();if(!source.geometry.userData.shared)source.geometry.dispose();source.geometry=g;
 }stats.chippedCorner=changed>0;
}
function leanHouse(house,stats){
 // A small affine lean preserves the grounded base. It includes decals and glass,
 // but never moves the annex, tile, saved cells, colliders or gameplay footprint.
 house.matrixAutoUpdate=false;house.updateMatrix();const shear=new THREE.Matrix4().set(1,.035,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1);house.matrix.multiply(shear);stats.leanDegrees=Math.atan(.035)*180/Math.PI;
}
export function applyBuildingWear(house,grade){
 const wear=wearForGrade(grade),stats={grade:grade??'A+',value:wear,panes:0,cracked:0,missing:0,boarded:0};house.userData.wear=stats;
 applyWalls(house,wear,stats);
 applyRoof(house,wear,stats);
 stats.chippedCorner=false;stats.leanDegrees=0;if(wear>=.85)chipCorner(house,stats);
 const windows=[];house.traverse(o=>{if(o.isMesh&&o.material.name==='Windows')windows.push(o);});
 if(wear<.35)return stats;
 const panes=[];
 for(const source of windows){
  const parts=splitComponents(source.geometry).flatMap(splitPanes);for(const geometry of parts){const pane=new THREE.Mesh(geometry,source.material);pane.position.copy(source.position);pane.quaternion.copy(source.quaternion);pane.scale.copy(source.scale);source.parent.add(pane);panes.push(pane);}source.parent.remove(source);
 }
 // Stable order: lower visible panes first; higher grades keep earlier flaws.
 house.updateMatrixWorld(true);panes.sort((a,b)=>{const ac=a.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(a.matrixWorld),bc=b.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(b.matrixWorld);return bc.z-ac.z||bc.x-ac.x||ac.y-bc.y;});
 stats.panes=panes.length;
 const cracked=wear>=.85?Math.ceil(panes.length*.8):wear>=.6?3:1,texture=crackTexture();
 panes.forEach((pane,i)=>{
  if(wear>=.6&&i===3){pane.material=material('#25322f');pane.userData.wear='missing-pane';stats.missing++;return;}
  if(i>=cracked)return;
  const overlay=new THREE.Mesh(paneUV(pane.geometry.clone()),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,side:THREE.DoubleSide}));
  pane.add(overlay);if(wear>=.85&&i<2){boardPane(pane);stats.boarded++;}pane.userData.wear='cracked-pane';stats.cracked++;
 });
 if(wear>=.85)leanHouse(house,stats);
 return stats;
}
