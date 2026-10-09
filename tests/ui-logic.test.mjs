import test from 'node:test';
import assert from 'node:assert/strict';
import {makeDefaultData} from '../data.js';
import {compareSnapshots} from '../sync-logic.js';
import {elapsedFor,makeFocusSession} from '../timer-logic.js';

test('conflict comparison identifies exact check and preference fields',()=>{
 const a=makeDefaultData('2026-10-10'),b=structuredClone(a);
 b.records['2026-10-10']=[a.routines[0].id];
 b.preferences.theme='violet';
 const r=compareSnapshots(a,b);
 assert.equal(r.total,2);
 assert.ok(r.items.some(x=>x.type==='체크'&&x.device==='미완료'&&x.cloud==='완료'));
 assert.ok(r.items.some(x=>x.type==='설정'&&x.label==='테마'));
});
test('comparison limits displayed entries but preserves full difference count',()=>{
 const a=makeDefaultData('2026-10-10'),b=structuredClone(a);
 b.records['2026-10-10']=a.routines.slice(0,6).map(r=>r.id);
 const r=compareSnapshots(a,b,2);
 assert.equal(r.total,6);assert.equal(r.items.length,2);assert.equal(r.hidden,4);
});
test('timer caps runtime, handles pauses and retains start date at midnight',()=>{
 const start=Date.parse('2026-10-09T14:59:00.000Z');
 const clock={running:true,startedMs:start,accruedMs:0,sessionStartMs:start,sessionId:'study_test',category:'수학'};
 assert.equal(elapsedFor(clock,start+61_000),61_000);
 const saved=makeFocusSession(clock,start+180_000,'study_test');
 assert.equal(saved.date,'2026-10-09');
 assert.equal(saved.seconds,180);
 assert.equal(saved.id,'study_test');
 assert.equal(elapsedFor({...clock,startedMs:start-24*60*60*1000},start),12*60*60*1000);
 assert.equal(elapsedFor({...clock,running:false,accruedMs:45000},start+100000),45000);
});
test('subsecond timers are not recorded as completed sessions',()=>{
 const t=Date.parse('2026-10-09T12:00:00.000Z');
 assert.equal(makeFocusSession({running:true,startedMs:t,accruedMs:0,sessionStartMs:t,category:'수학'},t+900,'test'),null);
});
