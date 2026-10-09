import test from 'node:test';
import assert from 'node:assert/strict';
import {makeDefaultData,todayKey,addDays,dayStat,weekStart,weeklyItems,weeklySummary,rangeStat,streak,applyToggle,validatedData,dayOfWeek,routineRate} from '../data.js';
const date='2026-10-10';
test('Seoul timezone boundary',()=>{
 assert.equal(todayKey(new Date('2026-10-09T15:00:01Z')),'2026-10-10');
 assert.equal(todayKey(new Date('2026-10-09T14:59:59Z')),'2026-10-09');
 assert.equal(addDays('2026-10-31',1),'2026-11-01');
 assert.equal(weekStart('2026-10-10'),'2026-10-05');
 assert.equal(dayOfWeek('2026-10-10'),6);
});
test('defaults match study schedule',()=>{
 const d=makeDefaultData(date);assert.equal(d.routines.length,14);
 assert.equal(dayStat(d,date).total,8);assert.equal(dayStat(d,date).rate,0);
 assert.equal(weeklyItems(d,date,date).length,3);
 assert.equal(weeklySummary(weeklyItems(d,date,date)).target,6);
 assert.equal(dayStat(d,'2026-10-09').rate,null);
});
test('daily check toggle and optional exclusion',()=>{
 let d=makeDefaultData(date), id=d.routines[0].id;
 d=applyToggle(d,date,id,date);assert.deepEqual(dayStat(d,date),{done:1,total:8,rate:.125});
 d=applyToggle(d,date,id,date);assert.equal(dayStat(d,date).done,0);
 d=applyToggle(d,date,d.routines.find(r=>r.optional).id,date);assert.equal(dayStat(d,date).done,0);
 assert.throws(()=>applyToggle(d,'2026-10-11',id,date),/미래/);
 assert.throws(()=>applyToggle(d,'2026-10-09',id,date),/체크/);
});
test('weekly counts and cap',()=>{
 let d=makeDefaultData('2026-10-05');let w=d.routines.find(r=>r.freq==='weekly'&&r.target===3);
 for(const day of ['2026-10-05','2026-10-06','2026-10-07','2026-10-08']) d=applyToggle(d,day,w.id,'2026-10-10');
 let summary=weeklySummary(weeklyItems(d,date,date));assert.equal(summary.done,3);assert.equal(summary.target,6);
 let item=weeklyItems(d,date,date).find(x=>x.routine.id===w.id);assert.equal(item.count,4);assert.equal(item.complete,true);
});
test('streak skips incomplete today; prior days count',()=>{
 let d=makeDefaultData('2026-10-05');
 for(const day of ['2026-10-08','2026-10-09'])for(const r of d.routines.filter(r=>r.freq==='daily'&&!r.optional))d=applyToggle(d,day,r.id,'2026-10-10');
 assert.equal(streak(d,'2026-10-10'),2);
 assert.equal(rangeStat(d,'2026-10-08','2026-10-11','2026-10-10').total,24);
});
test('deleted routines preserve past record, not future',()=>{
 let d=makeDefaultData('2026-10-01'),id=d.routines[0].id;
 d=applyToggle(d,'2026-10-02',id,'2026-10-10');
 d.routines[0].deletedAt='2026-10-10';
 assert.equal(dayStat(d,'2026-10-02').done,1);
 assert.equal(dayStat(d,'2026-10-10').total,7);
});
test('import validation and invalid structure',()=>{
 let d=makeDefaultData(date);assert.equal(validatedData(JSON.parse(JSON.stringify(d))).routines.length,14);
 assert.throws(()=>validatedData({version:1,routines:[],records:{'2026-11-34':['bad']}}));
 assert.throws(()=>validatedData({version:2,routines:[],records:{}}));
 d.records[date]=['unknown'];assert.throws(()=>validatedData(d));
});
