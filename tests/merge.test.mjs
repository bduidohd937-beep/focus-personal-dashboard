import test from 'node:test';
import assert from 'node:assert/strict';
import {makeDefaultData,validatedData} from '../data.js';
import {mergeSnapshots} from '../sync-logic.js';
const DAY='2026-10-10';
const clone=x=>structuredClone(x);
const base=()=>makeDefaultData(DAY);
const sess=(id,category='수학')=>({id,category,date:DAY,seconds:600,startedAt:DAY+'T01:00:00.000Z',endedAt:DAY+'T01:10:00.000Z'});

test('merges separate routine checks made on two offline devices',()=>{
 const b=base(),l=clone(b),r=clone(b);
 l.records[DAY]=[b.routines[0].id];
 r.records[DAY]=[b.routines[1].id];
 const result=mergeSnapshots(b,l,r);
 assert.equal(result.ok,true);
 assert.deepEqual(new Set(result.merged.records[DAY]),new Set([b.routines[0].id,b.routines[1].id]));
});
test('preserves intentional unchecks while merging a different new check',()=>{
 const b=base();b.records[DAY]=[b.routines[0].id];
 const l=clone(b),r=clone(b);
 delete l.records[DAY];
 r.records[DAY]=[b.routines[0].id,b.routines[1].id];
 const result=mergeSnapshots(b,l,r);
 assert.equal(result.ok,true);
 assert.deepEqual(result.merged.records[DAY],[b.routines[1].id]);
});
test('does not drop distinct focus sessions saved on separate devices',()=>{
 const b=base(),l=clone(b),r=clone(b);
 l.sessions.push(sess('phone'));r.sessions.push(sess('desktop','영어'));
 const result=mergeSnapshots(b,l,r);
 assert.equal(result.ok,true);
 assert.deepEqual(new Set(result.merged.sessions.map(x=>x.id)),new Set(['phone','desktop']));
});
test('detects conflicting routine edits and refuses silent overwrite',()=>{
 const b=base(),l=clone(b),r=clone(b);
 l.routines[0].name='독서 수정 A';
 r.routines[0].name='독서 수정 B';
 const result=mergeSnapshots(b,l,r);
 assert.equal(result.ok,false);
 assert.ok(result.conflicts.some(x=>x.startsWith('routines:')));
});
test('detects conflicting theme choices but merges theme and target date separately',()=>{
 const b=base(),l=clone(b),r=clone(b);
 l.preferences.theme='violet';r.preferences.theme='amber';
 assert.equal(mergeSnapshots(b,l,r).ok,false);
 r.preferences.theme=b.preferences.theme;
 r.preferences.examDate='2026-11-19';
 const result=mergeSnapshots(b,l,r);
 assert.equal(result.ok,true);
 assert.equal(result.merged.preferences.theme,'violet');
 assert.equal(result.merged.preferences.examDate,'2026-11-19');
});
test('rejects deleted routine with orphaned new checks rather than losing records',()=>{
 const b=base(),l=clone(b),r=clone(b);
 l.routines=l.routines.slice(1);
 r.records[DAY]=[b.routines[0].id];
 const result=mergeSnapshots(b,l,r);
 assert.equal(result.ok,false);
});
test('merged result keeps old backup format and strict model validation',()=>{
 const b=base(),l=clone(b),r=clone(b);
 delete l.sessions;delete l.preferences;
 const result=mergeSnapshots(b,l,r);
 assert.equal(result.ok,true);
 assert.doesNotThrow(()=>validatedData(result.merged));
});
