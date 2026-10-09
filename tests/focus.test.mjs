import test from 'node:test';
import assert from 'node:assert/strict';
import {makeDefaultData,validatedData,focusSummary,focusRange,examDaysLeft,formatDuration} from '../data.js';
const t='2026-10-10';
const session=(id,date,seconds,category='수학')=>({id,date,category,seconds,startedAt:date+'T02:00:00.000Z',endedAt:date+'T03:00:00.000Z'});
test('new empty default includes opt-in focus fields',()=>{
 const d=makeDefaultData(t);
 assert.deepEqual(d.sessions,[]);
 assert.equal(d.preferences.theme,'emerald');
 assert.equal(d.preferences.examDate,'');
});
test('V1 backups are upgraded without losing checks',()=>{
 const d=makeDefaultData(t);d.records[t]=[d.routines[0].id];
 delete d.sessions;delete d.preferences;
 const upgraded=validatedData(d);
 assert.deepEqual(upgraded.records[t],[d.routines[0].id]);
 assert.deepEqual(upgraded.sessions,[]);
 assert.equal(upgraded.preferences.dailyMinutesGoal,180);
});
test('daily and range stats sum exact seconds and categories',()=>{
 let d=makeDefaultData(t);
 d.sessions=[session('x','2026-10-09',3650),session('y','2026-10-10',300,'국어'),session('z','2026-10-10',125)];
 assert.equal(focusSummary(d,t).seconds,425);
 assert.equal(focusSummary(d,t).byCategory.국어,300);
 assert.equal(focusRange(d,'2026-10-09','2026-10-11',t).seconds,4075);
 assert.equal(focusRange(d,'2026-10-10','2026-10-11',t).seconds,425);
 assert.equal(formatDuration(4075),'1시간 07분');
});
test('sessions are validated and record duplicates rejected',()=>{
 const d=makeDefaultData(t);
 d.sessions=[session('a',t,60)];
 assert.equal(validatedData(d).sessions.length,1);
 d.sessions.push(session('a',t,60));
 assert.throws(()=>validatedData(d),/집중 기록/);
 d.sessions[1].id='b';d.sessions[1].seconds=-1;
 assert.throws(()=>validatedData(d),/집중 기록/);
});
test('theme, date and daily goal reject malformed inputs',()=>{
 const d=makeDefaultData(t);
 d.preferences.examDate='2026-11-19';
 d.preferences.theme='ocean';
 assert.equal(validatedData(d).preferences.theme,'ocean');
 assert.equal(examDaysLeft('2026-11-19','2026-11-18'),1);
 assert.equal(examDaysLeft('2026-11-19','2026-11-19'),0);
 assert.equal(examDaysLeft('2026-11-19','2026-11-20'),-1);
 d.preferences.dailyMinutesGoal=9999;
 assert.throws(()=>validatedData(d),/개인화/);
});
