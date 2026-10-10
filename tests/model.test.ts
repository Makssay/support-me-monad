import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeJson, missionDefaults, categories, normalizeCategory, socialPostId, safeLink, scoreFor } from '../shared/model';
test('Untrusted metadata preserves field types and drops unknown fields', () => { const parsed = safeJson('{"title": 42,"socialRequired":"yes","description":"Hello","__proto__":{"evil":true}}', missionDefaults); assert.equal(parsed.title, 'Untitled mission'); assert.equal(parsed.socialRequired, false); assert.equal(parsed.description, 'Hello'); assert.equal(Object.hasOwn(parsed, '__proto__'), false); });
test('Social URLs accept exact X/Twitter hosts and string IDs only', () => { assert.equal(socialPostId('https://x.com/alice/status/1234567890123456789?s=20'), '1234567890123456789'); for (const url of ['https://x.com.evil.test/a/status/12', 'https://evil.test/a/status/12', 'http://x.com/a/status/12', 'javascript:alert(1)', 'https://secret@x.com/a/status/12']) assert.equal(socialPostId(url), null); });
test('Public links reject script schemes', () => { assert.equal(safeLink('javascript:alert(1)'), undefined); assert.equal(safeLink('https://x.com/a/status/12'), 'https://x.com/a/status/12'); });
test('Signal Score derives only from accepted contributions and distinct missions', () => { assert.equal(scoreFor(2, 2), 30); assert.equal(scoreFor(0, 0), 0); });

test("five current categories retain historical task visibility without rewriting metadata",()=>{assert.deepEqual(categories.slice(1),["Memes","Feedback","Social content","Replies","Bug hunting"]);assert.equal(normalizeCategory("Testing"),"Feedback");assert.equal(normalizeCategory("Launch support"),"Social content");assert.equal(normalizeCategory("Memes"),"Memes");});
