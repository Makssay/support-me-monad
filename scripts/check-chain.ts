import { formatEther } from 'ethers';
import { checkedProvider, deployer, safeFailure } from './env';
try { const p = await checkedProvider(); const wallet = deployer(p); console.log(JSON.stringify({ chainId: Number((await p.getNetwork()).chainId), address: wallet.address, balanceMON: formatEther(await p.getBalance(wallet.address)), block: await p.getBlockNumber() }, null, 2)); p.destroy(); } catch { safeFailure('Chain check'); }
