import {CATEGORIES,STORAGE_KEY,makeDefaultData,validatedData,todayKey,dayOfWeek,weekStart,addDays,shiftMonth,monthEnd,formatKorean,shortDate,dayStat,rangeStat,streak,weeklyItems,weeklySummary,activeRoutines,hasCheck,applyToggle,routineRate,routineWeekCount,pct,makeId,clamp,isAlive,WEEKDAYS,focusSummary,focusRange,examDaysLeft,formatDuration} from './data.js';
import {initCloud,localChanged,cloudPanel,cloudAction,authSubmit,badge} from './cloud.js';
import {timerPanel,timerTick,timerAction,timerStorageChanged,timerRunning} from './timer.js';

const $ = q => document.querySelector(q);
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = n => Number(n).toLocaleString('ko-KR');
let memory;
let storageProblem='';
function readSaved(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(raw){try{return validatedData(JSON.parse(raw));}catch(e){storageProblem='기존 저장 데이터 형식에 문제가 있어 새 기록으로 시작했어요. 이전 데이터는 덮어쓰지 않았습니다. 먼저 데이터를 백업해 주세요.';return makeDefaultData();}}
  }catch(e){storageProblem='브라우저 저장소를 사용할 수 없습니다. 입력이 새로고침 후 사라질 수 있어요.';}
  return makeDefaultData();
}
let data=readSaved();
let view=['home','focus','calendar','stats','settings'].includes(location.hash.slice(1))?location.hash.slice(1):'home';
let selected=todayKey(),visibleMonth=todayKey().slice(0,7)+'-01',statsRange=7,editId=null,toastTimer;
function save(next,{fromCloud=false}={}){
 let persisted=false;
 try{
   if(!storageProblem || !storageProblem.startsWith('기존 저장')){
     // Persist first: cloud downloads must never be reported as saved when the browser is full.
     localStorage.setItem(STORAGE_KEY,JSON.stringify(next));
     storageProblem='';persisted=true;
   }else{
     storageProblem='이전 데이터에 문제가 있어 덮어쓰지 않고 있습니다. 설정에서 데이터 내보내기를 이용하세요.';
   }
 }catch(e){storageProblem='저장 실패: 저장 공간 또는 브라우저 권한을 확인하세요.';}
 if(persisted||!fromCloud)data=next;
 render();
 if(!fromCloud && persisted)localChanged();
 if(storageProblem)notify(storageProblem);
 return persisted;
}
function notify(message){const t=$('#toast');t.textContent=message;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),3400);}
function card(title,inside,extra=''){return `<section class="card"><div class="card-head"><h2 class="card-title">${title}</h2>${extra}</div>${inside}</section>`;}
function header(kicker,title,description,right='') {return `<div class="page-header"><div class="lead"><p class="eyebrow">${kicker}</p><h1 class="page-title">${title}</h1><p class="page-description">${description}</p></div>${right}</div>`;}
function track(rate,orange=false){return `<div class="track ${orange?'orange':''}"><span style="width:${clamp((rate??0)*100,0,100)}%"></span></div>`;}
function miniMetric(title,value,sub,icon){return `<div class="metric-card"><div class="metric-head"><span>${title}</span><span class="metric-icon">${icon}</span></div><strong>${value}</strong><p>${sub}</p></div>`;}
function renderTask(r,date){const checked=hasCheck(data,date,r.id);return `<button class="task ${checked?'done':''}" data-action="toggle" data-date="${date}" data-id="${esc(r.id)}" aria-pressed="${checked}" aria-label="${esc(r.name)}, ${checked?'완료 취소':'완료 체크'}"><span class="mark">✓</span><span class="task-name">${esc(r.name)}</span><span class="category">${esc(r.category)}</span></button>`;}
function renderList(date,{freq,optional}){
 const list=activeRoutines(data,date,{frequency:freq,optional});
 if(!list.length)return '<div class="empty">표시할 루틴이 없어요. 설정에서 추가할 수 있어요.</div>';
 return `<div class="task-list">${list.map(r=>renderTask(r,date)).join('')}</div>`;
}
function bars(days=7,base=todayKey()){
 const items=Array.from({length:days},(_,i)=>{const date=addDays(base,i-days+1);return {date,s:dayStat(data,date)};});
 return `<div class="bars" aria-label="최근 ${days}일 달성률">${items.map(({date,s})=>{const rate=s.rate??0,percent=Math.round(rate*100);return `<div class="bar-col ${date===base?'today':''}" title="${date} · ${s.done}/${s.total} · ${pct(s.rate)}"><span class="bar-value">${s.rate===null?'–':percent+'%'}</span><div class="bar-container"><div class="bar-fill ${percent===0?'zero':''}" style="height:${percent}%"></div></div><small>${days<=7?WEEKDAYS[dayOfWeek(date)]:Number(date.slice(-2))}</small></div>`;}).join('')}</div>`;
}
function getGreeting(){const hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',hour:'numeric',hour12:false}).format(new Date()))%24;return hour<5?'조용한 새벽, 집중할 시간.':hour<11?'좋은 아침이야. 시작해볼까?':hour<17?'오늘도 차근차근.':'오늘의 성장을 기록해봐.';}
function renderHome(){
 const today=todayKey(),day=dayStat(data,today),ws=weekStart(today),wk=weeklyItems(data,today),wks=weeklySummary(wk),st=streak(data,today),m=rangeStat(data,today.slice(0,7)+'-01',today,today);
 const required=activeRoutines(data,today,{frequency:'daily',optional:false});
 const opt=activeRoutines(data,today,{frequency:'daily',optional:true});
 const weekly=activeRoutines(data,today,{frequency:'weekly'});
 const tag=`<span class="tag"><span class="spark"></span> 오늘의 기록</span>`;
 const focusToday=focusSummary(data,today),prefs=data.preferences||{},dday=examDaysLeft(prefs.examDate,today);
 const goalStrip='<div class="focus-mini"><div><span>오늘 집중</span><strong>'+formatDuration(focusToday.seconds)+'</strong><small>목표 '+(prefs.dailyMinutesGoal||180)+'분</small></div><div><span>'+esc(prefs.examName||'목표일')+'</span><strong>'+(dday===null?'날짜 설정':dday>0?'D-'+dday:dday===0?'D-DAY':'D+'+Math.abs(dday))+'</strong><small>'+esc(prefs.examDate||'설정에서 지정')+'</small></div></div>';
 const homeFocus='<section class="home-focus-bar"><div><p class="eyebrow">QUICK FOCUS</p><h2>바로 공부 시작</h2><p>과목을 고르고 타이머를 실행해.</p></div><div class="home-focus-action"><label for="homeSubject">과목 선택</label><select id="homeSubject" '+(timerRunning()?'disabled':'')+'>'+CATEGORIES.filter(x=>!['기타','생활'].includes(x)).map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('')+'</select><button class="btn primary" data-action="focus-quick-start">'+(timerRunning()?'진행 중인 집중 열기':'집중 시작 →')+'</button></div></section>';
 const checklist=`<div class="section-label"><i class="dash"></i> 매일 루틴 <span class="small-note">${day.done}/${day.total}</span></div>${renderList(today,{freq:'daily',optional:false})}
 ${weekly.length?`<div class="section-label"><i class="dash amber"></i> 주간 목표 <span class="small-note">이번 주</span></div>${renderList(today,{freq:'weekly'})}`:''}
 ${opt.length?`<div class="section-label"><i class="dash purple"></i> 생활 · 선택</div>${renderList(today,{freq:'daily',optional:true})}`:''}`;
 const weekProgress=wk.length?wk.map(x=>`<div class="progress-row"><div class="progress-top"><strong>${esc(x.routine.name)}</strong><span>${x.count} / ${x.target}회 ${x.complete?'✓':''}</span></div>${track(Math.min(x.count/x.target,1),true)}</div>`).join(''):'<div class="empty">주간 목표가 없어요.</div>';
 return `${header('YOUR DAILY FOCUS',getGreeting(),`${formatKorean(today)} · 작은 체크가 쌓여 변화를 만들어요.`,tag)}
 <section class="hero-card"><div><div class="hero-label">TODAY'S PROGRESS</div><h2>${day.total?day.done===day.total?'오늘 목표 완료!':'하나씩 완성해 나가자.':'오늘의 목표를 설정해봐.'}</h2><p>${day.total?`필수 루틴 ${day.total}개 중 ${day.done}개 완료`:'설정에서 매일 루틴을 추가할 수 있어요.'}</p></div><div class="hero-right"><div class="ring" style="--rate:${Math.round((day.rate??0)*100)}"><div class="ring-inner"><strong>${pct(day.rate===null?0:day.rate)}</strong><small>달성률</small></div></div></div></section>
 ${homeFocus}${goalStrip}<div class="summary-grid">${miniMetric('이번 주 목표',`${wks.done}<em> / ${wks.target}</em>`,'주간 횟수 누적','◎')}${miniMetric('연속 성공',`${st}<em>일</em>`,'필수 일일 루틴 전부 완료','♨')}${miniMetric('이번 달 달성',pct(m.rate===null?0:m.rate),'오늘까지의 일일 기록','▥')}</div>
 <div class="content-grid"><div class="stack">${card('오늘의 체크리스트',checklist,`<span class="small-note">${formatKorean(today)}</span>`)}</div><div class="stack">${card('최근 7일',bars(7,today)+`<div class="insight"><span>✦</span><span>체크하면 그래프가 바로 바뀌어요. 실제로 입력한 기록만 집계해요.</span></div>`,`<span class="small-note">일일 루틴 기준</span>`)}${card('이번 주 목표',weekProgress,`<span class="small-note">${shortDate(ws)} ~ ${shortDate(addDays(ws,6))}</span>`)}</div></div>
 <p class="footnote">연속 성공일은 필수 일일 루틴을 모두 완료한 날만 계산해요. 오늘이 미완료라면 어제까지의 기록을 기준으로 보여줘요. 선택 루틴과 주간 목표는 일일 달성률에 포함되지 않아요.</p>`;
}
function monthCells(month){
 const year=Number(month.slice(0,4)),mon=Number(month.slice(5,7)),first=month,days=Number(monthEnd(month).slice(-2)),offset=dayOfWeek(first),today=todayKey();
 const gap=Array.from({length:offset},()=>`<div class="cal-day muted" aria-hidden="true"></div>`).join('');
 const cells=Array.from({length:days},(_,i)=>{const d=String(i+1).padStart(2,'0'),key=`${year}-${String(mon).padStart(2,'0')}-${d}`,s=dayStat(data,key),full=s.total>0&&s.done===s.total;
 const type=s.total===0?'no-plan':full?'complete':s.done?'some':'';
 return `<button class="cal-day ${key===selected?'picked':''} ${key===today?'current':''} ${key>today?'future':''}" data-action="pick-date" data-date="${key}" ${key>today?'disabled':''} aria-label="${key} ${s.done}/${s.total}개 완료"><span class="cal-date">${i+1}</span><span class="cal-dot ${type}"></span></button>`;}).join('');
 return `${WEEKDAYS.map(x=>`<span class="day-name">${x}</span>`).join('')}${gap}${cells}`;
}
function renderCalendar(){
 const t=todayKey(),s=dayStat(data,selected),wk=weeklyItems(data,selected,t),ws=weekStart(selected),wks=weeklySummary(wk),[year,month]=visibleMonth.split('-');
 const allDaily=activeRoutines(data,selected,{frequency:'daily',optional:false});
 const allWeekly=activeRoutines(data,selected,{frequency:'weekly'});
 const allOptional=activeRoutines(data,selected,{frequency:'daily',optional:true});
 return `${header('YOUR HISTORY','캘린더','매일 쌓인 기록을 돌아보고, 놓친 체크도 채워봐.')}
 <div class="calendar-layout">${card('',`<div class="calendar-toolbar"><button class="arrow-button" data-action="prev-month" aria-label="이전 달">‹</button><h2>${year}년 ${Number(month)}월</h2><button class="arrow-button" data-action="next-month" aria-label="다음 달">›</button></div><div class="calendar-days">${monthCells(visibleMonth)}</div><div class="cal-legend"><span><i class="full"></i> 모두 완료</span><span><i class="partial"></i> 일부 완료</span><span><i></i> 미완료</span></div>`)}
 ${card('',`<div class="day-detail-title"><div><p class="eyebrow">SELECTED DATE</p><h2>${formatKorean(selected)}</h2></div><span class="tag">${s.done}/${s.total} 완료</span></div><p class="day-summary" style="margin:12px 0 19px">일일 달성률 ${pct(s.rate)} · 그 주의 목표 ${wks.done}/${wks.target}회</p><div class="section-label"><i class="dash"></i> 매일 루틴</div>${allDaily.length?renderList(selected,{freq:'daily',optional:false}):'<div class="empty">이 날짜에 설정된 루틴이 없어요.</div>'}${allWeekly.length?`<div class="section-label"><i class="dash amber"></i> 주간 루틴</div>${renderList(selected,{freq:'weekly'})}`:''}${allOptional.length?`<div class="section-label"><i class="dash purple"></i> 선택 루틴</div>${renderList(selected,{freq:'daily',optional:true})}`:''}`,`<button class="muted-btn" data-action="back-today">오늘로</button>`)}
 </div><p class="footnote">미래 날짜에는 체크할 수 없어요. 루틴을 새로 만들기 전 날짜는 자동으로 목표에 포함하지 않아요.</p>`;
}
function renderFocus(){
 const t=todayKey(),daily=focusSummary(data,t),week=focusRange(data,addDays(t,-6),t,t),month=focusRange(data,t.slice(0,7)+'-01',t,t),goal=(data.preferences?.dailyMinutesGoal||180)*60;
 const subjects=Object.entries(month.byCategory).sort((a,b)=>b[1]-a[1]);
 const recent=(data.sessions||[]).slice().sort((a,b)=>b.endedAt.localeCompare(a.endedAt)).slice(0,12);
 return header('DEEP WORK','집중 모드','집중한 시간만 기록해 내 공부 패턴을 확인해봐.')+
 timerPanel(data,t)+
 '<div class="focus-mini"><div><span>오늘 공부</span><strong>'+formatDuration(daily.seconds)+'</strong><small>일일 목표 '+Math.min(100,Math.round(daily.seconds/goal*100))+'% 달성</small></div><div><span>최근 7일</span><strong>'+formatDuration(week.seconds)+'</strong><small>이번 달 '+formatDuration(month.seconds)+'</small></div></div>'+
 '<div class="split-grid"><div class="stack">'+card('이번 달 과목별 시간',subjects.length?subjects.map(([cat,secs])=>
 '<div class="progress-row"><div class="progress-top"><strong>'+esc(cat)+'</strong><span>'+formatDuration(secs)+'</span></div>'+track(secs/month.seconds)+'</div>').join(''):'<div class="empty">아직 저장한 집중 기록이 없어요.</div>')+'</div>'+
 '<div class="stack">'+card('최근 집중 기록',recent.length?recent.map(x=>
 '<div class="session-row"><b>'+esc(x.category)+'</b><span>'+esc(x.date)+'</span><strong>'+formatDuration(x.seconds)+'</strong></div>').join(''):'<div class="empty">타이머를 실행하고 기록 저장을 눌러보세요.</div>')+'</div></div>'+
 '<p class="footnote">완료해 저장한 세션만 동기화돼요. 타이머가 실행 중인 동안 브라우저를 닫아도 경과 시간은 계속 계산됩니다.</p>';
}
function renderStats(){
 const t=todayKey(),ws=weekStart(t),month=t.slice(0,7)+'-01',week=rangeStat(data,ws,t,t),ms=rangeStat(data,month,t,t),wk=weeklyItems(data,t),wsum=weeklySummary(wk),days=statsRange,start=addDays(t,-days+1);
 const aliveList=data.routines.filter(r=>r.active&&!r.deletedAt).sort((a,b)=>a.order-b.order);
 const daily=aliveList.filter(r=>r.freq==='daily');
 const dailyTable=daily.map(r=>{const val=routineRate(data,r,start,t,t);return `<div class="progress-row"><div class="progress-top"><strong>${esc(r.name)} ${r.optional?'<span class="subtle">· 선택</span>':''}</strong><span>${val.done}/${val.total}일 · ${pct(val.rate)}</span></div>${track(val.rate)}</div>`;}).join('')||'<div class="empty">일일 루틴이 없어요.</div>';
 const weekly=aliveList.filter(r=>r.freq==='weekly').map(r=>{const count=routineWeekCount(data,r,t,t);return `<div class="progress-row"><div class="progress-top"><strong>${esc(r.name)}</strong><span>${count}/${r.target}회</span></div>${track(Math.min(count/r.target,1),true)}</div>`;}).join('')||'<div class="empty">주간 루틴이 없어요.</div>';
 const focus30=focusRange(data,addDays(t,-29),t,t);
 const byCategory=CATEGORIES.map(cat=>{const rows=aliveList.filter(r=>r.category===cat&&r.freq==='daily'&&!r.optional);let done=0,total=0;for(const r of rows){const s=routineRate(data,r,start,t,t);done+=s.done;total+=s.total;}return {cat,done,total,rate:total?done/total:null};}).filter(x=>x.total>0);
 return `${header('PROGRESS ANALYTICS','나의 성장 기록','실제로 체크한 데이터로 이번 주와 지난 기록을 확인해봐.')}
 <div class="stat-top-grid">${miniMetric('이번 주',pct(week.rate??0),`${week.done}/${week.total}회 완료`,'▤')}${miniMetric('이번 달',pct(ms.rate??0),`${ms.done}/${ms.total}회 완료`,'◎')}${miniMetric('연속 성공',`${streak(data,t)}<em>일</em>`,'필수 루틴 100%','♨')}</div>
 <div class="split-grid"><div class="stack">${card('일일 달성 추이',`<div class="button-row"><button data-action="range" data-range="7" class="chip ${days===7?'active':''}">최근 7일</button><button data-action="range" data-range="30" class="chip ${days===30?'active':''}">최근 30일</button></div>${bars(days,t)}`,`<span class="small-note">${shortDate(start)} – ${shortDate(t)}</span>`)}${card('과목별 달성률',byCategory.length?byCategory.map(x=>`<div class="progress-row"><div class="progress-top"><strong>${esc(x.cat)}</strong><span>${x.done}/${x.total} · ${pct(x.rate)}</span></div>${track(x.rate)}</div>`).join(''):'<div class="empty">아직 집계할 기록이 없어요.</div>')}</div><div class="stack">${card('일일 루틴 상세',dailyTable,`<span class="small-note">최근 ${days}일</span>`)}${card('이번 주 주간 목표',weekly,`<span class="small-note">달성 ${wsum.completed}/${wsum.count}</span>`)}</div></div>
 <div class="focus-mini"><div><span>최근 30일 집중</span><strong>${formatDuration(focus30.seconds)}</strong><small>타이머 저장 기준</small></div><div><span>주간 목표</span><strong>${wsum.done} / ${wsum.target}</strong><small>주간 횟수</small></div></div><p class="footnote">일일 달성률은 필수 루틴 완료 횟수 ÷ 해당 기간의 필수 루틴 예정 횟수예요. 주간 루틴은 별도 집계하며, 미래일과 루틴 생성 전 날짜는 제외해요. 비활성화된 루틴은 모든 통계에서 제외돼요.</p>`;
}
function renderPreferences(){
 const p=data.preferences||{};
 const themes=[['emerald','에메랄드'],['violet','바이올렛'],['ocean','오션 블루'],['amber','앰버']];
 return card('개인화 설정',
 '<form id="prefsForm" class="prefs-form"><div class="fields"><label>테마 색상<select name="theme">'+themes.map(([id,label])=>'<option value="'+id+'" '+(p.theme===id?'selected':'')+'>'+label+'</option>').join('')+'</select></label>'+
 '<label>하루 집중 목표(분)<input type="number" name="dailyGoal" min="10" max="1440" required value="'+(p.dailyMinutesGoal||180)+'"></label></div>'+
 '<div class="fields"><label>시험·목표 이름<input maxlength="40" name="examName" value="'+esc(p.examName||'수능')+'" placeholder="수능·논술 등"></label>'+
 '<label>목표 날짜<input type="date" name="examDate" value="'+esc(p.examDate||'')+'"></label></div>'+
 '<button class="btn primary mt-18" type="submit">개인화 저장</button></form>','<span class="small-note">내 스타일</span>');
}
function renderSettings(){
 const routines=data.routines.filter(r=>!r.deletedAt).sort((a,b)=>a.order-b.order);
 const list=routines.map(r=>`<div class="setting-item"><div class="meta"><b>${esc(r.name)}</b><span>${esc(r.category)} · ${r.freq==='daily'?'매일':`주 ${r.target}회`}${r.optional?' · 선택':''}${!r.active?' · 일시 중지':''}</span></div><button type="button" role="switch" aria-checked="${r.active}" aria-label="${esc(r.name)} ${r.active?'비활성화':'활성화'}" class="switch ${r.active?'on':''}" data-action="set-active" data-id="${esc(r.id)}"></button><button class="btn-icon" data-action="edit-routine" data-id="${esc(r.id)}" title="수정" aria-label="${esc(r.name)} 수정">✎</button><button class="btn-icon" data-action="delete-routine" data-id="${esc(r.id)}" title="삭제" aria-label="${esc(r.name)} 삭제">×</button></div>`).join('')||'<div class="empty">아직 루틴이 없어요.</div>';
 return `${header('PREFERENCES','나만의 설정','루틴과 목표를 자유롭게 바꾸고 데이터를 안전하게 관리해봐.')}
 ${cloudPanel()}${renderPreferences()}<div class="settings-grid"><div class="stack">${card('나의 루틴',list+`<button class="btn primary mt-18" data-action="new-routine">＋ 루틴 추가하기</button>`,`<span class="small-note">${routines.length}개</span>`)}</div><div class="stack">${card('데이터 보관',`<div class="info-box"><b>로컬 저장 + 선택적 클라우드 동기화</b><br>체크는 이 브라우저에 먼저 저장되고, 연결되면 클라우드로 전송돼요. 정기적인 JSON 백업도 권장해요.</div><div class="button-row mt-18"><button class="btn primary" data-action="export">↓ JSON 백업</button><button class="btn ghost" data-action="import">↑ 백업 복원</button></div><input id="importFile" type="file" accept=".json,application/json" hidden/><p class="inline-message mt-12">백업을 복원하면 현재 기록 전체가 교체돼요. 복원 전에 확인 창이 표시돼요.</p>`)}${card('초기화',`<div class="info-box warn"><b>주의: 기록은 복구되지 않아요.</b><br>중요한 기록이 있다면 먼저 JSON 백업을 내려받으세요.</div><button class="btn danger mt-18" data-action="reset">모든 기록 초기화</button>`)}</div></div><p class="footnote">갤럭시: Chrome 메뉴 → 홈 화면에 추가 / 앱 설치. 오프라인에서도 마지막으로 저장된 앱 화면을 열 수 있도록 구성했어요.</p>`;
}
function render(){
 const today=todayKey();document.documentElement.dataset.theme=data.preferences?.theme||'emerald';$('#topDate').textContent=formatKorean(today);
 const status=$('#syncStatus');if(status)status.textContent=badge();
 document.querySelectorAll('[data-nav]').forEach(a=>{a.classList.toggle('active',a.dataset.nav===view);a.setAttribute('aria-current',a.dataset.nav===view?'page':'false');});
 const warning=storageProblem?`<div class="banner">${esc(storageProblem)}</div>`:'';
 $('#app').innerHTML=warning+({home:renderHome,focus:renderFocus,calendar:renderCalendar,stats:renderStats,settings:renderSettings}[view]());
}
function openDialog(r){
 editId=r?.id||null;
 $('#routineDialogTitle').textContent=r?'루틴 수정':'루틴 추가';
 $('#routineName').value=r?.name||'';
 $('#routineCategory').innerHTML=[...new Set([...CATEGORIES,...(r&&!CATEGORIES.includes(r.category)?[r.category]:[])])].map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
 $('#routineCategory').value=r?.category||'수학';
 $('#routineFreq').value=r?.freq||'daily';
 $('#routineTarget').value=String(r?.target||1);
 $('#routineOptional').checked=Boolean(r?.optional);
 updateTargetVisibility();$('#routineDialog').showModal();$('#routineName').focus();
}
function updateTargetVisibility(){$('#targetField').hidden=$('#routineFreq').value!=='weekly';}
function modifyRoutine(form){
 const input = key => form.elements.namedItem(key);
 const name=String(input('name').value||'').trim();if(!name||name.length>60)return notify('이름을 입력해 주세요.');
 const category=input('category').value,freq=input('freq').value,target=freq==='daily'?1:parseInt(input('target').value,10),optional=input('optional').checked;
 if(!['daily','weekly'].includes(freq)||!(target>=1&&target<=7))return notify('횟수를 다시 선택해 주세요.');
 if(editId){data={...data,routines:data.routines.map(r=>r.id===editId?{...r,name,category,freq,target,optional}:r)};}
 else{data={...data,routines:[...data.routines,{id:makeId(),name,category,freq,target,optional,active:true,createdAt:todayKey(),deletedAt:null,order:data.routines.length}]};}
 $('#routineDialog').close();save(data);notify(editId?'루틴이 수정됐어요.':'새 루틴을 추가했어요.');
}
async function importBackup(file){if(!file)return;if(file.size>2_000_000)return notify('백업 파일이 너무 커요 (2MB 이하).');
 try{const d=validatedData(JSON.parse(await file.text()));const count=Object.keys(d.records).length;
 if(!confirm(`루틴 ${d.routines.length}개, 기록 ${count}일치를 복원할까요?\n현재 기기의 데이터는 모두 교체됩니다.`))return;
 // Explicit import is allowed to recover from a corrupt localStorage state.
 storageProblem='';save(d);notify('백업 데이터를 복원했어요.');
 }catch(e){notify(e.message||'올바른 FOCUS 백업 파일이 아니에요.');}}
function exportBackup(){
 const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download=`FOCUS-backup-${todayKey()}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);notify('백업 파일을 저장했어요.');
}
document.addEventListener('click',event=>{
 const el=event.target.closest('[data-action]');if(!el)return;
 const action=el.dataset.action,today=todayKey();
 try{
  if(action==='focus-quick-start'){
   if(!timerRunning()){
    const ok=timerAction('timer-start',$('#homeSubject')?.value,()=>true,notify);
    if(!ok)return;
   }
   location.hash='#focus';render();
  }
  else if(action.startsWith('timer-')){timerAction(action,$('#timerCategory')?.value,session=>{
   if((data.sessions||[]).some(x=>x.id===session.id))return true;
   return save({...data,sessions:[...(data.sessions||[]),session]});
  },notify);render();}
  else if(action==='toggle'){save(applyToggle(data,el.dataset.date,el.dataset.id,today));}
  else if(action==='pick-date'){selected=el.dataset.date;render();}
  else if(action==='prev-month'){visibleMonth=shiftMonth(visibleMonth,-1);render();}
  else if(action==='next-month'){visibleMonth=shiftMonth(visibleMonth,1);render();}
  else if(action==='back-today'){selected=today;visibleMonth=today.slice(0,7)+'-01';render();}
  else if(action==='range'){statsRange=Number(el.dataset.range);render();}
  else if(action==='new-routine'){openDialog();}
  else if(action==='edit-routine'){const r=data.routines.find(r=>r.id===el.dataset.id);if(r)openDialog(r);}
  else if(action==='set-active'){save({...data,routines:data.routines.map(r=>r.id===el.dataset.id?{...r,active:!r.active}:r)});}
  else if(action==='delete-routine'){const r=data.routines.find(r=>r.id===el.dataset.id);if(r&&confirm(`‘${r.name}’ 루틴을 삭제할까요?\n지난 기록은 보존돼요.`)){save({...data,routines:data.routines.map(x=>x.id===r.id?{...x,deletedAt:today}:x)});notify('루틴을 삭제했어요.');}}
  else if(action.startsWith('cloud-')){cloudAction(action).catch(e=>notify(e.message||'동기화 오류'));}
  else if(action==='export'){exportBackup();}
  else if(action==='import'){$('#importFile')?.click();}
  else if(action==='reset'){if(confirm('모든 루틴과 기록을 초기화할까요? 이 작업은 되돌릴 수 없어요.')&&confirm('정말 초기화할까요? 백업을 하지 않았다면 기록이 사라져요.')){storageProblem='';save(makeDefaultData());notify('기본 루틴으로 초기화했어요.');}}
 }catch(e){notify(e.message||'처리 중 오류가 발생했어요.');}
});
document.addEventListener('submit',event=>{if(event.target.id==='prefsForm'){
 event.preventDefault();const f=event.target;
 const theme=f.elements.namedItem('theme').value;
 const examDate=f.elements.namedItem('examDate').value;
 const examName=f.elements.namedItem('examName').value.trim()||'목표일';
 const dailyMinutesGoal=Number(f.elements.namedItem('dailyGoal').value);
 if(!['emerald','violet','ocean','amber'].includes(theme)||!Number.isInteger(dailyMinutesGoal)||dailyMinutesGoal<10||dailyMinutesGoal>1440)return notify('집중 목표는 10~1440분으로 입력해 주세요.');
 save({...data,preferences:{theme,examDate,examName,dailyMinutesGoal}});
 notify('개인화 설정이 저장됐어요.');return;
 }if(event.target.id==='cloudAuthForm'){event.preventDefault();authSubmit(event.target,event.submitter?.value||'signin').catch(e=>notify(e.message||'로그인 오류'));}});
document.addEventListener('change',event=>{if(event.target.id==='routineFreq')updateTargetVisibility();if(event.target.id==='importFile'){importBackup(event.target.files?.[0]);event.target.value='';}});
document.querySelectorAll('[data-close-dialog]').forEach(btn=>btn.addEventListener('click',()=>$('#routineDialog').close()));
$('#routineForm').addEventListener('submit',event=>{event.preventDefault();modifyRoutine(event.currentTarget);});
window.addEventListener('hashchange',()=>{const next=location.hash.slice(1);if(['home','focus','calendar','stats','settings'].includes(next)){view=next;render();window.scrollTo({top:0,behavior:'instant'});}});
window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY){data=readSaved();render();}if(event.key==='focus.timer.v2'){timerStorageChanged();render();}});
setInterval(()=>{const current=todayKey();if(current!==lastSeenToday){lastSeenToday=current;selected=selected>current?current:selected;render();}},30000);
let lastSeenToday=todayKey();setInterval(timerTick,1000);
if(!location.hash)history.replaceState(null,'','#home');
render();
initCloud({getLocal:()=>data,replaceLocal:d=>save(d,{fromCloud:true}),notify,refresh:render});
if('serviceWorker' in navigator && ['https:','http:'].includes(location.protocol)){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));}
