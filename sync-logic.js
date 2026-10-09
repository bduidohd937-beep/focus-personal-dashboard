import {makeDefaultData} from './data.js';
export function equalData(a,b){return JSON.stringify(a)===JSON.stringify(b);}
export function hasPersonalData(data){
 if(!data||!Array.isArray(data.routines)||!data.records)return false;
 if(Object.values(data.records).some(v=>Array.isArray(v)&&v.length>0))return true;
 if(Array.isArray(data.sessions)&&data.sessions.length>0)return true;
 const baseline=makeDefaultData('2000-01-01').preferences;
 const prefs=data.preferences||baseline;
 if(['theme','examDate','examName','dailyMinutesGoal'].some(k=>prefs[k]!==baseline[k]))return true;
 const defaults=makeDefaultData('2000-01-01').routines;
 if(defaults.length!==data.routines.length)return true;
 return defaults.some((d,i)=>{
   const r=data.routines[i];
   if(!r)return true;
   return ['id','name','category','freq','target','optional','active','deletedAt','order'].some(k=>r[k]!==d[k]);
 });
}
