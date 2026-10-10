import { build } from 'esbuild';
await build({entryPoints:['server/cloud-handler.ts'],outfile:'.server/handler.cjs',bundle:true,platform:'node',format:'cjs',target:'node22',logLevel:'warning'});
console.log('Server API bundle ready.');
