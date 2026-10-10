import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
test('Live cache path deduplicates concurrent lookups and stops at budget cap without spending',()=>{
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'support-social-cache-'));const root=process.cwd();
 const result=execFileSync(process.execPath,[path.join(root,'node_modules/tsx/dist/cli.mjs'),path.join(root,'tests/social-cache-worker.ts')],{cwd:temporary,encoding:'utf8',windowsHide:true,env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,TEMP:process.env.TEMP}});
 assert.match(result,/hard budget cap passed/);
});
