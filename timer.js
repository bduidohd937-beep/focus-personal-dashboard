import {CATEGORIES,makeId,todayKey,formatDuration} from './data.js';
import {elapsedFor,makeFocusSession} from './timer-logic.js';
const KEY='focus.timer.v2';
const CAP=12*60*60*1000;
const defaultTimer=()=>({running:false,startedMs:0,accruedMs:0,sessionStartMs:0,sessionId:'',category:'수학'});
function read(){
 try {
  const r=JSON.parse(localStorage.getItem(KEY)||'null');
  if(r && typeof r==='object' && CATEGORIES.includes(r.category)&&typeof r.running==='boolean'&&Number.isFinite(r.startedMs)&&Number.isFinite(r.accruedMs)&&Number.isFinite(r.sessionStartMs)&&r.accruedMs>=0&&r.accruedMs<=CAP&&r.startedMs>=0)return {...r,sessionId:r.sessionId||''};
 } catch {}
 return defaultTimer();
}
let timer=read();
function persist(next){try{localStorage.setItem(KEY,JSON.stringify(next));timer=next;return true;}catch{return false;}}
export function elapsedMs(now=Date.now()){return elapsedFor(timer,now);}
export function timerRunning(){return timer.running||elapsedMs()>0;}
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
 const now=Date.now(),elapsed=elapsedMs(now);
 const fail=()=>notify('타이머를 이 기기에 저장하지 못했어요. 저장 공간을 확인해 주세요.');
 if(action==='timer-start'){
  if(timer.running||elapsed)return false;
  const next={running:true,startedMs:now,accruedMs:0,sessionStartMs:now,sessionId:makeId(),category:CATEGORIES.includes(category)?category:'수학'};
  if(!persist(next)){fail();return false;}
 }else if(action==='timer-pause'){
  if(!timer.running)return false;
  if(!persist({...timer,accruedMs:elapsed,running:false,startedMs:0})){fail();return false;}
 }else if(action==='timer-resume'){
  if(timer.running||elapsed<1000)return false;
  if(!persist({...timer,running:true,startedMs:now})){fail();return false;}
 }else if(action==='timer-reset'){
  if(!confirm('진행 중인 타이머를 취소할까요? 기록되지 않은 시간은 사라져요.'))return false;
  if(!persist(defaultTimer())){fail();return false;}
 }else if(action==='timer-stop'){
  const result=makeFocusSession(timer,now,timer.sessionId||makeId());
  if(!result)return notify('1초 이상 집중한 다음 저장해 주세요.'),false;
  // Saving the study record must succeed before we clear the running timer.
  const ok=onComplete(result);
  if(ok===false){notify('공부 기록 저장에 실패했어요. 타이머를 보존했습니다.');return false;}
  if(!persist(defaultTimer()))notify('공부 기록은 저장됐지만 타이머 초기화에 실패했어요. 다시 시도하기 전에 JSON 백업을 권장해요.');
  else notify('집중 기록 '+formatDuration(result.seconds)+'이 저장됐어요.');
 }else return false;
 return true;
}
export function timerStorageChanged(){timer=read();timerTick();}
