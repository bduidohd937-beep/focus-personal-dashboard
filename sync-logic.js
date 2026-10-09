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


// Human-readable comparison for the conflict resolver. Descriptions are plain data,
// escaped by the UI before rendering.
export function compareSnapshots(localValue,remoteValue,limit=24){
 const local=validatedData(localValue),remote=validatedData(remoteValue);
 const items=[];
 let count=0;
 const add=(type,label,device,cloud)=>{
   count++;
   if(items.length<limit)items.push({type,label,device,cloud});
 };
 const same=(a,b)=>equalData(a,b);
 const lr=new Map(local.routines.map(x=>[x.id,x]));
 const rr=new Map(remote.routines.map(x=>[x.id,x]));
 const routineName=id=>lr.get(id)?.name||rr.get(id)?.name||id;
 for(const id of new Set([...lr.keys(),...rr.keys()])){
   const l=lr.get(id),r=rr.get(id);
   if(!same(l,r))add('루틴',routineName(id),l?(l.deletedAt?'삭제됨':l.name+(l.active?'':' · 중지')):'없음',r?(r.deletedAt?'삭제됨':r.name+(r.active?'':' · 중지')):'없음');
 }
 for(const date of [...new Set([...Object.keys(local.records),...Object.keys(remote.records)])].sort().reverse()){
   const l=new Set(local.records[date]||[]),r=new Set(remote.records[date]||[]);
   for(const id of new Set([...l,...r])){
     if(l.has(id)!==r.has(id))add('체크',date+' · '+routineName(id),l.has(id)?'완료':'미완료',r.has(id)?'완료':'미완료');
   }
 }
 const ls=new Map(local.sessions.map(x=>[x.id,x])),rs=new Map(remote.sessions.map(x=>[x.id,x]));
 for(const id of new Set([...ls.keys(),...rs.keys()])){
   const l=ls.get(id),r=rs.get(id);
   if(!same(l,r))add('집중',((l||r).date)+' · '+((l||r).category),l?Math.floor(l.seconds/60)+'분':'없음',r?Math.floor(r.seconds/60)+'분':'없음');
 }
 const preferenceLabels={theme:'테마',examDate:'목표 날짜',examName:'목표 이름',dailyMinutesGoal:'하루 집중 목표(분)'};
 for(const [key,label] of Object.entries(preferenceLabels)){
   if(!same(local.preferences[key],remote.preferences[key]))add('설정',label,String(local.preferences[key]||'미설정'),String(remote.preferences[key]||'미설정'));
 }
 return {total:count,items,hidden:Math.max(0,count-items.length)};
}
