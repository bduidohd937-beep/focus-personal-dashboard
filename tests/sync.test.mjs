import test from 'node:test';
import assert from 'node:assert/strict';
import {hasPersonalData,equalData} from '../sync-logic.js';
import {makeDefaultData,applyToggle} from '../data.js';
test('fresh defaults do not trigger destructive first-login conflict',()=>{
 const d=makeDefaultData('2026-10-10');
 assert.equal(hasPersonalData(d),false);
 const later=makeDefaultData('2026-10-11');
 assert.equal(hasPersonalData(later),false);
});
test('edited routines and completed records count as personal data',()=>{
 const d=makeDefaultData('2026-10-10');
 d.routines[0].name='변경한 공부';assert.equal(hasPersonalData(d),true);
 const a=makeDefaultData('2026-10-10');
 assert.equal(hasPersonalData(applyToggle(a,'2026-10-10',a.routines[0].id,'2026-10-10')),true);
});
test('snapshot equality compares actual records',()=>{
 const d=makeDefaultData('2026-10-10');
 assert.equal(equalData(d,structuredClone(d)),true);
 const x=structuredClone(d);x.routines[0].name='새 루틴';assert.equal(equalData(d,x),false);
});

test('focus sessions and preferences count as personal data before first login',()=>{
 const a=makeDefaultData('2026-10-10');
 a.sessions.push({id:'study_1',date:'2026-10-10',category:'수학',seconds:120,startedAt:'2026-10-10T10:00:00.000Z',endedAt:'2026-10-10T10:02:00.000Z'});
 assert.equal(hasPersonalData(a),true);
 const b=makeDefaultData('2026-10-10');
 b.preferences.theme='violet';
 assert.equal(hasPersonalData(b),true);
 const c=makeDefaultData('2026-10-10');
 c.preferences.examDate='2026-11-19';
 assert.equal(hasPersonalData(c),true);
});
