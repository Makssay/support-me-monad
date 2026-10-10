import test from 'node:test';
import assert from 'node:assert/strict';
import { AI_MODEL, AI_VERSION, DEFAULT_RUBRIC, parseRubric } from '../shared/ai';
import { validateReview, assess, aiUsage, aiBudget } from '../server/ai';
import { missionDefaults, requiresXEvidence } from '../shared/model';
test('AI X sources require evidence even when the old optional flag is false',()=>{
 for(const category of ['Replies','Social content'])assert.equal(requiresXEvidence({...missionDefaults,category}),true);
 assert.equal(requiresXEvidence(missionDefaults,'https://x.com/person/status/123'),true);
 assert.equal(requiresXEvidence(missionDefaults,'https://example.com/report'),false);
 assert.equal(requiresXEvidence(missionDefaults),false);
});
test('unconfirmed X text never falls back to the form or calls the AI provider',async()=>{
 const before=aiUsage().reservedUsd;let calls=0;
 const transport=(async()=>{calls++;throw new Error('Must not call provider');}) as typeof fetch;
 const meta={...missionDefaults,title:'X evidence regression',aiModel:AI_MODEL,aiVersion:AI_VERSION,aiRubric:DEFAULT_RUBRIC};
 for(const category of ['Feedback','Replies','Social content']){
  for(const evidence of [undefined,{status:'unavailable'},{status:'verified',text:''},{status:'verified',text:'  '}]){
   const first=await assess({...meta,category},'A fabricated excellent reply',evidence,transport,'https://x.com/person/status/123');
   const second=await assess({...meta,category},'A different fabricated reply',evidence,transport,'https://x.com/person/status/123');
   assert.equal(first.status,'uncertain');assert.equal(first.inputHash,second.inputHash);
  }
 }
 assert.equal(calls,0);assert.equal(aiUsage().reservedUsd,before);
});
test('frozen rubric rejects invalid weights and arbitrary oversized criteria',()=>{assert.equal(parseRubric(DEFAULT_RUBRIC).length,3);assert.throws(()=>parseRubric('[{"criterion":"test","weight":99}]'));assert.throws(()=>parseRubric(JSON.stringify([{criterion:'x'.repeat(161),weight:100}])));});
test('model output validates verdict, scores and reasons before use',()=>{assert.throws(()=>validateReview({status:'pass',scores:[999],reason:'ok'},1));assert.throws(()=>validateReview({status:'pass',scores:[90],reason:'ok'},3));assert.throws(()=>validateReview({status:'winner',scores:[90],reason:'ok'},1));assert.deepEqual(validateReview({status:'uncertain',scores:[0],reason:'Evidence missing'},1).status,'uncertain');});
test('required social evidence cannot be judged as verified or billed',async()=>{const before=aiUsage().reservedUsd;let called=false;const r=await assess({...missionDefaults,title:'Missing social evidence unit test',socialRequired:true,aiModel:AI_MODEL,aiVersion:AI_VERSION,aiRubric:DEFAULT_RUBRIC},'A claimed reply',undefined,(async()=>{called=true;throw new Error();}) as typeof fetch);assert.equal(r.status,'uncertain');assert.equal(called,false);assert.equal(aiUsage().reservedUsd,before);});
test('unsupported model policy never silently falls back',async()=>{await assert.rejects(()=>assess({...missionDefaults,aiModel:'unpublished-model',aiVersion:AI_VERSION,aiRubric:DEFAULT_RUBRIC},'text'));});
test('invalid spending configuration cannot disable the budget cap',()=>{assert.equal(aiBudget('NaN'),0);assert.equal(aiBudget('Infinity'),0);assert.equal(aiBudget('-1'),0);assert.equal(aiBudget('0'),0);assert.equal(aiBudget('.25'),.25);});

test('rubric supports one to ten positive integer weights, always totaling exactly 100',()=>{
 assert.equal(parseRubric(JSON.stringify([{criterion:'One',weight:100}])).length,1);
 const ten=Array.from({length:10},(_,i)=>({criterion:'Criterion '+i,weight:10}));
 assert.equal(parseRubric(JSON.stringify(ten)).length,10);
 for(const weights of [[40,35,24],[40,35,26],[99],[101]])assert.throws(()=>parseRubric(JSON.stringify(weights.map((weight,i)=>({criterion:'C'+i,weight})))));
 for(const invalid of [[...ten,{criterion:'Too many',weight:1}],[{criterion:'',weight:100}],[{criterion:'Fraction',weight:99.5},{criterion:'Other',weight:.5}],[{criterion:'Zero',weight:0},{criterion:'Other',weight:100}]])assert.throws(()=>parseRubric(JSON.stringify(invalid)));
 assert.equal(validateReview({status:'pass',scores:Array(10).fill(90),reason:'Meets the rubric'},10).scores.length,10);
 assert.throws(()=>validateReview({status:'pass',scores:Array(9).fill(90),reason:'Missing score'},10));
 assert.throws(()=>validateReview({status:'pass',scores:Array(11).fill(90),reason:'Extra score'},10));
});
