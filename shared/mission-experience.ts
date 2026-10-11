import { sameAddress, type Mission, type Contribution } from './model';

export function missionPhase(m: Mission, now: number) {
 if (m.closed) return m.recovery?.active ? 'refunded' : [4,6].includes(m.mode||0)&&!m.draw?.settled ? 'cancelled' : 'closed';
 if (m.recovery?.active || m.recoveryAt && now >= m.recoveryAt && !m.draw?.ready && ([4,6].includes(m.mode||0)||m.mode===0&&m.automation?.enabled)) return 'recovery';
 if (m.draw?.ready) return 'settling';
 if (m.draw?.requested) return 'randomness';
 if (now < m.deadline) return 'open';
 if ([4,6].includes(m.mode||0)) return 'draw';
 if (now <= (m.reviewDeadline ?? m.deadline)) return 'review';
 if (m.mode===5) return 'ai-refund';
 if (m.automation?.enabled) return m.mode===0 ? 'fallback' : 'overdue';
 return 'expired';
}

export function personalNextStep(m:Mission, entries:Contribution[], wallet:string, now:number) {
 const mine=entries.find(c=>sameAddress(c.contributor,wallet));
 if (!wallet) return 'Sign in to see your next step.';
 if (mine?.status===1) return mine.transferred===false ? 'Your reward is ready to claim from your profile.' : 'Your reward is recorded onchain. Open the payout receipt below.';
 if (m.closed) return m.recovery?.active ? 'The draw did not finish. Pending entries were not judged as winners or losers.' : 'This mission is closed. Check the public results below.';
 if (sameAddress(m.creator,wallet)) return now<m.deadline ? 'Entries are open. Share your mission and review incoming work.' : now<=(m.reviewDeadline??m.deadline)&&![4,6].includes(m.mode||0) ? 'Review submissions before the deadline. Each payment is recorded onchain.' : 'Check the settlement controls below. Anyone can advance an eligible settlement.';
 if (mine?.status===4) return now<(mine.deliveryDeadline||0) ? 'Your reward is reserved. Deliver before your personal deadline.' : 'Your delivery deadline has passed. Release the expired assignment.';
 if (mine?.status===3) return 'Your proposal is registered. Wait for selection before doing the full work.';
 if (mine?.status===2) return 'The creator declined your work. Read the public reason below.';
 if (mine) return 'Your entry is registered. Follow its status here; do not submit again.';
 return now<m.deadline ? m.communityHash ? 'Check your eligibility before preparing any work.' : m.mode===2 ? 'Send a short proposal. Start the full work only after selection.' : m.mode===1 ? 'Reserve a paid place before preparing your report.' : 'Read the payment terms, then submit before the deadline.' : 'Entries are closed. You can follow the public outcome here.';
}

export function rewardTerms(m: Pick<Mission,'mode'|'automation'|'recoveryAt'>) {
 const mode=m.mode||0, protectedMode=!!m.automation?.enabled;
 const decision=mode===5?'AI ranks eligible entries using the published rubric.': [4,6].includes(mode)?'Pyth randomly selects winners from the fixed entry list.':'The creator reviews the published criteria and chooses whom to pay.';
 const payment=mode===2?'A proposal is unpaid. Selection reserves a reward; accepted delivery is paid.':mode===1?protectedMode?'Reserve first. Only an accepted report or a protected overdue delivery is paid.':'Reserve first. Reports require creator acceptance before payment.':mode===3?'Only confirmed, in-scope bugs qualify. Duplicate issues are paid once.':'Participation does not guarantee a reward.';
 const timeout=protectedMode&&mode===0?'If the creator misses review, remaining prizes enter a random draw.':protectedMode&&[1,2].includes(mode)?'If review is missed, on-time pending deliveries are paid automatically.':mode===5?'If AI settlement misses its deadline, unspent prizes can be refunded to the creator.':[4,6].includes(mode)?'No creator approval is needed for the draw.':'Unreviewed work does not automatically receive payment.';
 const outage=m.recoveryAt&&([4,6].includes(mode)||mode===0&&protectedMode)?'If Pyth misses the fixed recovery deadline, unspent prizes return to the creator. Earlier payouts stay paid.':undefined;
 return {decision,payment,timeout,outage};
}

export function accessFailureKind(message:string):'denied'|'unavailable'|'action' {
 if(['Your linked X account does not have the required blue checkmark.','Your Discord account does not meet the published requirement.','Your NFT wallet does not meet the published requirement.','Your wallet does not meet the minimum token balance.'].includes(message))return 'denied';
 if(/unavailable|temporarily|not configured|Failed to fetch|fetch failed|NetworkError|rate.limit|Too many|paused/i.test(message))return 'unavailable';
 return 'action';
}
