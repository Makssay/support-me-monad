import fs from 'node:fs';
const html=await(await fetch('https://docs.pyth.network/entropy/chainlist')).text();const urls=[...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m=>m[1]);
await Promise.all(urls.map(async path=>{const js=await(await fetch('https://docs.pyth.network'+path)).text();if(/monad|entropy.*fee|chains.*entropy/i.test(js)){fs.mkdirSync('.data/pyth',{recursive:true});fs.writeFileSync('.data/pyth/'+path.split('/').pop(),js);for(const m of js.matchAll(/.{0,120}(?:monad|entropy[^" ]*\.json|https:\/\/[^" ]*entropy[^" ]*).{0,200}/gi))console.log(m[0].slice(0,330));}}));
