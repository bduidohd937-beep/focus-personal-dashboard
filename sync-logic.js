import {makeDefaultData,validatedData} from './data.js';

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

// Three-way merge: only merge changes which do not contradict the common synced baseline.
// A conflicting edit stays unresolved; it must be chosen by the user, never overwritten.
export function mergeSnapshots(baseValue,localValue,remoteValue){
 const base=validatedData(baseValue),local=validatedData(localValue),remote=validatedData(remoteValue);
 const conflicts=[];
 function select(label,b,l,r){
   if(equalData(l,r))return l;
   if(equalData(l,b))return r;
   if(equalData(r,b))return l;
   conflicts.push(label);
   return l; // discarded by caller if conflicts is not empty
 }
 function mergeEntities(type,idField){
   const bs=new Map(base[type].map(v=>[v[idField],v]));
   const ls=new Map(local[type].map(v=>[v[idField],v]));
   const rs=new Map(remote[type].map(v=>[v[idField],v]));
   const ids=new Set([...bs.keys(),...ls.keys(),...rs.keys()]);
   const result=[];
   for(const id of ids){
     const selected=select(type+':'+id,bs.get(id),ls.get(id),rs.get(id));
     if(selected!==undefined)result.push(selected);
   }
   return result;
 }
 const routines=mergeEntities('routines','id');
 const sessions=mergeEntities('sessions','id');
 const preferences={};
 for(const key of ['theme','examDate','examName','dailyMinutesGoal']){
   preferences[key]=select('preferences:'+key,base.preferences[key],local.preferences[key],remote.preferences[key]);
 }
 const recordDates=new Set([...Object.keys(base.records),...Object.keys(local.records),...Object.keys(remote.records)]);
 const records={};
 for(const day of recordDates){
   const checkedB=new Set(base.records[day]||[]);
   const checkedL=new Set(local.records[day]||[]);
   const checkedR=new Set(remote.records[day]||[]);
   const ids=new Set([...checkedB,...checkedL,...checkedR]);
   const merged=[];
   for(const id of ids){
     if(select('records:'+day+':'+id,checkedB.has(id),checkedL.has(id),checkedR.has(id)))merged.push(id);
   }
   if(merged.length)records[day]=merged;
 }
 if(conflicts.length)return {ok:false,conflicts};
 try {
   return {ok:true,merged:validatedData({version:1,routines,records,sessions,preferences}),conflicts:[]};
 }catch(error){return {ok:false,conflicts:['유효하지 않은 병합 결과: '+error.message]};}
}
