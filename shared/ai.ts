export const AI_MODEL = 'google/gemini-3.1-flash-lite';
export const AI_VERSION = 'support-me-rubric-v1';
export const DEFAULT_RUBRIC = JSON.stringify([{ criterion: 'Matches the published brief', weight: 40 }, { criterion: 'Specific, relevant and substantiated', weight: 35 }, { criterion: 'Useful contribution for the stated goal', weight: 25 }]);
export const MAX_AI_CRITERIA = 10;
export interface Criterion { criterion: string; weight: number; }
export interface AIReview { status: 'pass' | 'fail' | 'uncertain'; scores: number[]; score: number; reason: string; model: string; version: string; inputHash: string; checkedAt: string; }
export interface AIResult { missionId: number; rankings: { contributionId: number; review: AIReview }[]; winners: number[]; resultHash: string; entryHash: string; validUntil: number; signature: string; }
export function parseRubric(value: string): Criterion[] {
 const items: unknown = JSON.parse(value);
 if (!Array.isArray(items) || items.length < 1 || items.length > MAX_AI_CRITERIA) throw new Error('Use one to ten AI criteria.');
 if (items.some(a => !a || typeof a.criterion !== 'string' || !a.criterion.trim() || a.criterion.length > 160 || !Number.isInteger(a.weight) || a.weight < 1 || a.weight > 100)) throw new Error('Give each criterion a name and an integer weight from 1 to 100.');
 if (items.reduce((n,a) => n+a.weight,0) !== 100) throw new Error('AI criteria weights must total 100.');
 return items.map(a => ({ criterion: a.criterion.trim(), weight: a.weight }));
}
export const aiReviewMessage = (id: number, contract: string, chain: number, time: number) => `Support Me\nAI review contribution ${id}\nContract ${contract.toLowerCase()}\nChain ${chain}\nTime ${time}`;
export const aiJudgeMessage = (id: number, contract: string, chain: number, time: number) => `Support Me\nFinalize AI contest ${id}\nContract ${contract.toLowerCase()}\nChain ${chain}\nTime ${time}`;
