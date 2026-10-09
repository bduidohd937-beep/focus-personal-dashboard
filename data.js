/* FOCUS core model: dependency-free, pure statistics, Asia/Seoul dates. */
export const TZ = 'Asia/Seoul';
export const CATEGORIES = ['국어', '수학', '영어', '탐구', '논술', '생활', '기타'];
export const WEEKDAYS = ['일','월','화','수','목','금','토'];
export const STORAGE_KEY = 'focus.personal.v1';
const dateFormat = new Intl.DateTimeFormat('en-GB', {timeZone: TZ, year:'numeric', month:'2-digit', day:'2-digit'});
export function todayKey(d=new Date()) {
  const p = Object.fromEntries(dateFormat.formatToParts(d).map(x=>[x.type,x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export const dateOnly = k => new Date(`${k}T00:00:00Z`);
export function addDays(k, n) { const d=dateOnly(k); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); }
export const dayOfWeek = k => dateOnly(k).getUTCDay();
export const weekStart = k => addDays(k, -((dayOfWeek(k)+6)%7));
export const monthStart = k => k.slice(0,7)+'-01';
export function monthEnd(k) {const [y,m] = k.split('-').map(Number); return new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);}
export function shiftMonth(k,delta) {const [y,m]=k.split('-').map(Number); return new Date(Date.UTC(y,m-1+delta,1)).toISOString().slice(0,10);}
export const datesBetween = (start,end) => { const r=[]; for(let d=start;d<=end;d=addDays(d,1)) {r.push(d); if(r.length>5000)break;} return r; };
export const formatKorean = k => {const [y,m,d]=k.split('-');return `${Number(m)}월 ${Number(d)}일 ${WEEKDAYS[dayOfWeek(k)]}요일`;};
export const shortDate = k => {const [,m,d]=k.split('-');return `${Number(m)}/${Number(d)}`;};
export const pct = r => r===null ? '–' : `${Math.round(r*100)}%`;
export const clamp = (x,a,b) => Math.min(b,Math.max(a,x));
const isDay = s => typeof s==='string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(dateOnly(s).getTime()) && dateOnly(s).toISOString().slice(0,10)===s;
export function makeDefaultData(date=todayKey()) {
 const items=[
 ['국어 독서','국어','daily',1,false],['국어 문학','국어','daily',1,false],
 ['수학 개념','수학','daily',1,false],['수학 기출','수학','daily',1,false],
 ['수학 실전모의고사','수학','weekly',3,false],['실모 복기','수학','weekly',2,false],
 ['영어 단어 50개','영어','daily',1,false],['영어 지문','영어','daily',1,false],
 ['생활과윤리','탐구','daily',1,false],['사회문화','탐구','daily',1,false],
 ['논술 연습','논술','weekly',1,false],
 ['기상 관리','생활','daily',1,true],['스터디카페 도착','생활','daily',1,true],['취침 관리','생활','daily',1,true]
 ];
 return {version:1,routines:items.map(([name,category,freq,target,optional],i)=>({id:`base_${i+1}`,name,category,freq,target,optional,active:true,createdAt:date,deletedAt:null,order:i})),records:{}};
}
export function isAlive(r,date) {return r.createdAt<=date && (!r.deletedAt || date<r.deletedAt);}
export function activeRoutines(data,date,{frequency,optional}={}) { return data.routines.filter(r=>r.active&&isAlive(r,date)&&(frequency===undefined||r.freq===frequency)&&(optional===undefined||r.optional===optional)).sort((a,b)=>a.order-b.order); }
export function hasCheck(data,date,id) {return (data.records[date]||[]).includes(id);}
export function dayStat(data,date) {
 const rs=activeRoutines(data,date,{frequency:'daily',optional:false});
 const done=rs.filter(r=>hasCheck(data,date,r.id)).length;
 return {done,total:rs.length,rate:rs.length?done/rs.length:null};
}
export function rangeStat(data,start,end,today=todayKey()) {
 let done=0,total=0,countDays=0;
 if(start>today)return {done,total,countDays,rate:null};
 for(const date of datesBetween(start,end<=today?end:today)) {const s=dayStat(data,date);done+=s.done;total+=s.total;countDays++;}
 return {done,total,countDays,rate:total?done/total:null};
}
export function streak(data,today=todayKey()) {
 let date=today, n=0;
 let s=dayStat(data,date);
 if(s.total===0||s.done!==s.total) date=addDays(date,-1);
 for(let i=0;i<5000;i++) {s=dayStat(data,date);if(!s.total||s.done!==s.total)break;n++;date=addDays(date,-1);}
 return n;
}
export function weeklyItems(data,date,today=todayKey()) {
 const start=weekStart(date),end=addDays(start,6);
 return data.routines.filter(r=>r.active && r.freq==='weekly' && r.createdAt<=end &&(!r.deletedAt||r.deletedAt>start)).sort((a,b)=>a.order-b.order).map(r=>{
  let count=0;
  const upTo= end<today?end:today;
  if(upTo>=start) for(const d of datesBetween(start,upTo)) if(isAlive(r,d)&&hasCheck(data,d,r.id))count++;
  return {routine:r,count,target:r.target,complete:count>=r.target};
 });
}
export function weeklySummary(items) {const req=items.filter(x=>!x.routine.optional);const done=req.reduce((s,x)=>s+Math.min(x.count,x.target),0),target=req.reduce((s,x)=>s+x.target,0);return {done,target,rate:target?done/target:null,completed:req.filter(x=>x.complete).length,count:req.length};}
export function routineRate(data,r,start,end,today=todayKey()) {
 let done=0,total=0;
 for(const d of datesBetween(start,end<today?end:today)) if(isAlive(r,d)){total++;if(hasCheck(data,d,r.id))done++;}
 return {done,total,rate:total?done/total:null};
}
export function routineWeekCount(data,r,date,today=todayKey()) {
 const start=weekStart(date),end=addDays(start,6);let count=0;
 if(start>today)return 0;
 for(const d of datesBetween(start,end<today?end:today))if(isAlive(r,d)&&hasCheck(data,d,r.id))count++;
 return count;
}
export function validatedData(x) {
 if(!x || typeof x!=='object'|| x.version!==1||!Array.isArray(x.routines)||!x.records||typeof x.records!=='object'||Array.isArray(x.records)) throw Error('지원하지 않는 백업 형식입니다.');
 if(x.routines.length>1000||Object.keys(x.records).length>5000)throw Error('백업 크기 제한을 초과했습니다.');
 const ids=new Set();
 const routines=x.routines.map((r,i)=>{
  if(!r||typeof r.id!=='string'||!/^[-_a-zA-Z0-9]{1,100}$/.test(r.id)||ids.has(r.id)||typeof r.name!=='string'||!r.name.trim()||r.name.length>60||typeof r.category!=='string'||r.category.length>24||!['daily','weekly'].includes(r.freq)||!Number.isInteger(r.target)||r.target<1||r.target>7||typeof r.active!=='boolean'||typeof r.optional!=='boolean'||!isDay(r.createdAt)|| (r.deletedAt!==null&&r.deletedAt!==undefined&&!isDay(r.deletedAt)))throw Error(`루틴 ${i+1}에 잘못된 값이 있습니다.`);
  ids.add(r.id);return {id:r.id,name:r.name.trim(),category:r.category||'기타',freq:r.freq,target:r.freq==='daily'?1:r.target,active:r.active,optional:r.optional,createdAt:r.createdAt,deletedAt:r.deletedAt||null,order:Number.isInteger(r.order)?r.order:i};
 });
 const records={};
 for(const [d,ar]of Object.entries(x.records)) {if(!isDay(d)||!Array.isArray(ar)||ar.length>1000||ar.some(v=>typeof v!=='string'||!ids.has(v)))throw Error(`기록 날짜 ${d}가 올바르지 않습니다.`);records[d]=[...new Set(ar)];}
 return {version:1,routines,records};
}
export function applyToggle(data,date,id,today=todayKey()) {
 if(date>today)throw Error('미래 날짜는 체크할 수 없습니다.');
 const r=data.routines.find(x=>x.id===id);
 if(!r||!r.active||!isAlive(r,date))throw Error('이 날짜에 체크할 수 없는 루틴입니다.');
 const old=data.records[date]||[], updated=old.includes(id)?old.filter(x=>x!==id):[...old,id];
 const records={...data.records};if(updated.length)records[date]=updated;else delete records[date];
 return {...data,records};
}
export const makeId = () => 'r_'+ (globalThis.crypto?.randomUUID?.().replaceAll('-','')||Math.random().toString(36).slice(2)+Date.now().toString(36));
