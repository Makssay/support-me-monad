import fs from 'node:fs';
import solc from 'solc';
export function compileAI() {
 const input={language:'Solidity',sources:{'AIContestController.sol':{content:fs.readFileSync('contracts/AIContestController.sol','utf8')}},settings:{optimizer:{enabled:true,runs:200},viaIR:true,evmVersion:'paris',outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object','evm.deployedBytecode.immutableReferences','metadata']}}}};
 const output=JSON.parse(solc.compile(JSON.stringify(input)));const errors=output.errors?.filter((e:any)=>e.severity==='error');if(errors?.length)throw new Error(errors.map((e:any)=>e.formattedMessage).join('\n'));
 const c=output.contracts['AIContestController.sol'].AIContestController;
 fs.writeFileSync('artifacts/AIContestController.json',JSON.stringify({abi:c.abi,bytecode:`0x${c.evm.bytecode.object}`,deployedBytecode:`0x${c.evm.deployedBytecode.object}`,immutableReferences:c.evm.deployedBytecode.immutableReferences,metadata:c.metadata},null,2));
 fs.writeFileSync('artifacts/ai-standard-input.json',JSON.stringify(input,null,2));fs.writeFileSync('shared/ai-abi.json',JSON.stringify(c.abi));return c;
}
if(process.argv[1]?.endsWith('compile-ai.ts')){compileAI();console.log('AI controller compiled.');}
