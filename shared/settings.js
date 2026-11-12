export const DEFAULT_KEYS=Object.freeze({rotate:'r',flip:'f',axis:'x',drop:' ',power:'q',coins:'c',pause:'p',nudgeLeft:'a',nudgeRight:'d'});
export const ACTION_LABELS={rotate:'Rotate',flip:'Flip',axis:'Switch axis',drop:'Drop',power:'Powerups',coins:'Coins',pause:'Pause',nudgeLeft:'Step left',nudgeRight:'Step right'};
export const defaultSettings=()=>({keys:{...DEFAULT_KEYS},sound:true,cameraSensitivity:1});
export function normalizeSettings(raw){
 const value=defaultSettings();if(!raw||typeof raw!=='object')return value;
 value.sound=raw.sound!==false;
 value.cameraSensitivity=Number.isFinite(raw.cameraSensitivity)?Math.max(.5,Math.min(2,raw.cameraSensitivity)):1;
 if(raw.keys&&typeof raw.keys==='object'){
  const keys=Object.fromEntries(Object.keys(DEFAULT_KEYS).map(action=>[action,raw.keys[action]??DEFAULT_KEYS[action]]));
  if(Object.values(keys).every(key=>typeof key==='string'&&(key===' '||/^[a-z0-9]$/.test(key)))&&new Set(Object.values(keys)).size===Object.keys(keys).length)value.keys=keys;
 }
 return value;
}
export function assignKey(settings,action,key){
 if(!(action in DEFAULT_KEYS))return 'Unknown action.';
 if(key!==' '&&!/^[a-z0-9]$/.test(key))return 'Choose a letter, number, or Space.';
 const used=Object.entries(settings.keys).find(([other,value])=>other!==action&&value===key);
 if(used)return `${ACTION_LABELS[used[0]]} already uses that key.`;
 settings.keys[action]=key;return null;
}
export const displayKey=key=>key===' '?'SPACE':key.toUpperCase();
