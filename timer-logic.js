import {todayKey} from './data.js';
const CAP=12*60*60*1000;
export function elapsedFor(timer,now=Date.now()){
 const previous=Number.isFinite(timer?.accruedMs)?Math.max(0,timer.accruedMs):0;
 const live=timer?.running&&Number.isFinite(timer.startedMs)?Math.max(0,now-timer.startedMs):0;
 return Math.min(CAP,previous+live);
}
export function makeFocusSession(timer,now,id){
 const seconds=Math.floor(elapsedFor(timer,now)/1000);
 if(seconds<1)return null;
 const started=Number.isFinite(timer.sessionStartMs)&&timer.sessionStartMs>0?timer.sessionStartMs:now-seconds*1000;
 const startedAt=new Date(Math.min(started,now)).toISOString();
 return {id:id||timer.sessionId,date:todayKey(new Date(started)),category:timer.category,seconds,startedAt,endedAt:new Date(now).toISOString()};
}
