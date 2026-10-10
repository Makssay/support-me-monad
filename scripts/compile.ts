import fs from 'node:fs';
import solc from 'solc';
export function compile() {
  const source = fs.readFileSync('contracts/SupportMe.sol', 'utf8');
  const input = { language: 'Solidity', sources: { 'SupportMe.sol': { content: source }, 'CommunityGate.sol': { content: fs.readFileSync('contracts/CommunityGate.sol','utf8') } }, settings: { optimizer: { enabled: true, runs: 1 }, viaIR:true, evmVersion: 'paris', outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object', 'metadata'] } } } };
  Object.assign(input.sources,Object.fromEntries(['SupportMeStorage.sol','SettlementEngine.sol'].map(name=>[name,{content:fs.readFileSync(`contracts/${name}`,'utf8')}])));
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = output.errors?.filter((e: { severity: string }) => e.severity === 'error');
  if (errors?.length) throw new Error(errors.map((e: { formattedMessage: string }) => e.formattedMessage).join('\n'));
  const c = output.contracts['SupportMe.sol'].SupportMe;
  fs.mkdirSync('artifacts',{recursive:true});const gate=output.contracts['CommunityGate.sol'].CommunityGate;fs.writeFileSync('shared/community-abi.json',JSON.stringify(gate.abi));fs.writeFileSync('artifacts/CommunityGate.json',JSON.stringify({abi:gate.abi,bytecode:'0x'+gate.evm.bytecode.object,deployedBytecode:'0x'+gate.evm.deployedBytecode.object,metadata:gate.metadata},null,2));
  console.log('Runtime bytes:',c.evm.deployedBytecode.object.length/2);
  if(c.evm.deployedBytecode.object.length/2>24576)throw new Error('Escrow exceeds EIP-170 deployment limit.');
  const engine=output.contracts['SettlementEngine.sol'].SettlementEngine;
  if(engine.evm.deployedBytecode.object.length/2>24576)throw new Error('Settlement engine exceeds EIP-170 deployment limit.');
  if(c.evm.bytecode.object.length/2>49152)throw new Error('Escrow exceeds initcode limit.');
  fs.mkdirSync('artifacts', { recursive: true });
  fs.writeFileSync('artifacts/SupportMe.json', JSON.stringify({ abi: c.abi, bytecode: `0x${c.evm.bytecode.object}`, deployedBytecode: `0x${c.evm.deployedBytecode.object}`, metadata: c.metadata }, null, 2));
  fs.writeFileSync('artifacts/standard-input.json', JSON.stringify(input, null, 2));
  fs.writeFileSync('shared/abi.json', JSON.stringify(c.abi));
  console.log('SupportMe compiled with Solidity 0.8.28 / Paris.');
  return c;
}
if (process.argv[1]?.endsWith('compile.ts')) compile();
