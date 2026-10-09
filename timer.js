import {CATEGORIES,makeId,todayKey,formatDuration} from './data.js';
const KEY='focus.timer.v2';
const CAP=12*60*60*1000;
const defaultTimer=()=>({running:false,startedMs:0,accruedMs:0,sessionStartMs:0,category:'수학'});
function read(){
 try {
  const r=JSON.parse(localStorage.getItem(KEY)||'null');
  if(r && typeof r==='object' && CATEGORIES.includes(r.category)&&typeof r.running==='boolean'&&Number.isFinite(r.startedMs)&&Number.isFinite(r.accruedMs)&&Number.isFinite(r.sessionStartMs)&&r.accruedMs>=0&&r.accruedMs<=CAP&&r.startedMs>=0)return r;
 } catch {}
 return defaultTimer();
}
let timer=read();
function persist(){try{localStorage.setItem(KEY,JSON.stringify(timer));}catch{}}
export function elapsedMs(now=Date.now()) {
 return Math.min(CAP,timer.accruedMs+(timer.running?Math.max(0,now-timer.startedMs):0));
}
function clock(ms) {
 const s=Math.floor(ms/1000),h=Math.floor(s/3600),m=Math.floor(s/60)%60,sec=s%60;
 return [h,m,sec].map(v=>String(v).padStart(2,'0')).join(':');
}
export function timerPanel(data,today){
 const seconds=Math.floor(elapsedMs()/1000);
 const summary=(data.sessions||[]).filter(x=>x.date===today).reduce((v,x)=>v+x.seconds,0);
 return '<section class="timer-hero">'+
 '<div><p class="eyebrow">DEEP WORK SESSION</p><h2>집중 타이머</h2><p class="page-description">시작하고 멈추면 실제 측정한 시간이 공부 기록에 추가돼요.</p></div>'+
 '<div id="timerDisplay" class="timer-clock" aria-live="off">'+clock(elapsedMs())+'</div>'+
 '<div class="timer-control">'+
 '<label>공부 과목 <select id="timerCategory" '+(seconds||timer.running?'disabled':'')+'>'+CATEGORIES.filter(v=>v!=='기타').map(x=>'<option '+(x===timer.category?'selected':'')+'>'+x+'</option>').join('')+'</select></label>'+
 '<div class="cloud-actions">'+
 (timer.running?'<button class="btn ghost" data-action="timer-pause">일시정지</button>':seconds?'<button class="btn primary" data-action="timer-resume">다시 시작</button>':'<button class="btn primary" data-action="timer-start">집중 시작</button>')+
 (seconds||timer.running?'<button class="btn ghost" data-action="timer-stop">기록 저장</button><button class="btn ghost" data-action="timer-reset">취소</button>':'')+
 '</div></div><p class="timer-note">오늘 누적 '+formatDuration(summary)+' · 기록은 기기에 즉시 저장되고 로그인 상태라면 클라우드로 동기화돼요. 최대 12시간/세션.</p></section>';
}
export function timerTick(){const el=document.getElementById('timerDisplay');if(el)el.textContent=clock(elapsedMs());}
export function timerAction(action,category,onComplete,notify){
 if(action==='timer-start'){
  if(timer.running||elapsedMs())return;
  timer={running:true,startedMs:Date.now(),accruedMs:0,sessionStartMs:Date.now(),category:CATEGORIES.includes(category)?category:'수학'};
 } else if(action==='timer-pause'){
  if(!timer.running)return;
  timer.accruedMs=elapsedMs();timer.running=false;timer.startedMs=0;
 } else if(action==='timer-resume'){
  if(timer.running||elapsedMs()===0)return;
  timer.running=true;timer.startedMs=Date.now();
 } else if(action==='timer-reset'){
  if(!confirm('진행 중인 타이머를 취소할까요? 기록되지 않은 시간은 사라져요.'))return;
  timer=defaultTimer();
 } else if(action==='timer-stop'){
  if(!timer.running&&elapsedMs()<1000)return notify('1초 이상 집중한 다음 저장해 주세요.');
  const seconds=Math.floor(elapsedMs()/1000);
  if(seconds<1)return notify('1초 이상 집중한 다음 저장해 주세요.');
  const session={id:makeId(),date:todayKey(),category:timer.category,seconds,startedAt:new Date(timer.sessionStartMs||Date.now()-seconds*1000).toISOString(),endedAt:new Date().toISOString()};
  timer=defaultTimer();persist();
  onComplete(session);
  notify('집중 기록 '+formatDuration(seconds)+'이 저장됐어요.');
  return;
 }
 persist();
}
export function timerStorageChanged(){timer=read();timerTick();}
