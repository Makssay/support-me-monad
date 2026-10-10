import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
function child(local:boolean){
 const folder=fs.mkdtempSync(path.resolve('.data/ai-env-test-'));const file=path.join(folder,'.env');fs.writeFileSync(file,'OPENROUTER_API_KEY=local-test-value\nSOCIAL_DATA_API_KEY=local-test-value\n');
 try{const module=pathToFileURL(path.resolve('server/env-normalize.ts')).href;const code=`import(${JSON.stringify(module)}).then(()=>console.log(process.env.OPENROUTER_API_KEY===${JSON.stringify(local?'':'local-test-value')}));`;
 const result=spawnSync(process.execPath,['--import',pathToFileURL(path.resolve('node_modules/tsx/dist/loader.mjs')).href,'-e',code],{cwd:folder,env:{...process.env,LOCAL_E2E:local?'1':'',OPENROUTER_API_KEY:local?'':'old-test-value',SOCIAL_DATA_API_KEY:''},encoding:'utf8',windowsHide:true});assert.equal(result.status,0);assert.equal(result.stdout.trim(),'true');
 }finally{fs.unlinkSync(file);fs.rmdirSync(folder);}
}
test('updated project AI key takes precedence over stale inherited desktop value',()=>child(false));
test('isolated QA retains empty provider key despite local env contents',()=>child(true));
