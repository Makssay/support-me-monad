import { test } from 'node:test';
import assert from 'node:assert/strict';
import { counted, noticeText, setLocale, translate } from '../src/i18n';
import { ru } from '../src/locales/ru';
import { categories, paymentModes, paymentRules } from '../shared/model';

test('Every category and payment agreement has Russian interface copy; unknown text stays intact', () => {
  for (const key of [...categories, ...paymentModes, ...paymentRules]) assert.ok(Object.hasOwn(ru, key), key);
  assert.equal(translate('Creator choice', 'en'), 'Creator choice');
  assert.equal(translate('Until {date}', 'ru', { date: '8 окт.' }), 'До 8 окт.');
  for (const unknown of ['constructor', 'toString', 'A creator-authored title']) assert.equal(translate(unknown, 'ru'), unknown);
});

test('Russian count forms and transaction notices remain correct when the language changes', () => {
  setLocale('ru');
  for (const [value, expected] of [[1, '1 работа'], [2, '2 работы'], [5, '5 работ'], [11, '11 работ'], [21, '21 работа'], [22, '22 работы'], [111, '111 работ']] as const) {
    assert.equal(counted(value, 'contribution', ['работа', 'работы', 'работ']), expected);
  }
  const notice = 'Confirm mission published & funded in your wallet. Support Me covers gas.';
  assert.equal(noticeText(notice), 'Подтверди действие «Задание опубликовано и оплачено» в кошельке. Support Me оплачивает газ.');
  setLocale('en');
  assert.equal(noticeText(notice), notice);
  assert.equal(counted(2, 'contribution', ['работа', 'работы', 'работ']), '2 contributions');
});
