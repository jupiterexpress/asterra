// PLACEHOLDER art direction only. These values never affect gameplay or saves.
export const WEAR_BY_GRADE=Object.freeze({'A+':0,A:.15,B:.35,C:.6,D:.85});
export function wearForGrade(grade){return WEAR_BY_GRADE[grade]??0;}

// PLACEHOLDER tie rule: the lower grade wins at equal axial hex distance.
// Unknown/missing legacy grades remain clean. Read-only; no save migrations.
export function nearestBuildingGrade(state,tile){
 let nearest=Infinity,grade='A+';
 for(const building of Object.values(state.tiles)){
  if(building.kind!=='building')continue;
  const dq=building.q-tile.q,dr=building.r-tile.r,distance=Math.max(Math.abs(dq),Math.abs(dr),Math.abs(dq+dr));
  const candidate=Object.hasOwn(WEAR_BY_GRADE,building.grade)?building.grade:'A+';
  if(distance<nearest||(distance===nearest&&wearForGrade(candidate)>wearForGrade(grade))){nearest=distance;grade=candidate;}
 }return grade;
}
