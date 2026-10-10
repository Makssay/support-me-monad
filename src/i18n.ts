import { useSyncExternalStore } from 'react';
import { ru } from './locales/ru';

export type Locale = 'en' | 'ru';
export const LOCALE_KEY = 'support.locale';
let locale: Locale = 'en';
try { if (localStorage.getItem(LOCALE_KEY) === 'ru') locale = 'ru'; } catch { /* Private browsing may disable storage. */ }
const listeners = new Set<() => void>();
function updateDocument() { if (typeof document !== 'undefined') document.documentElement.lang = locale; }
updateDocument();
export function setLocale(next: Locale) {
  if (next === locale) return;
  locale = next;
  try { localStorage.setItem(LOCALE_KEY, next); } catch { /* The choice still works for this session. */ }
  updateDocument();
  listeners.forEach(listener => listener());
}
if (typeof window !== 'undefined') window.addEventListener('storage', event => {
  if (event.key === LOCALE_KEY) setLocale(event.newValue === 'ru' ? 'ru' : 'en');
});
export function useLocale() {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => locale, () => 'en' as Locale);
}
export function translate(source: string, language: Locale, values: Record<string, string | number> = {}) {
  const translated = language === 'ru' && Object.hasOwn(ru, source) ? ru[source] : source;
  return translated.replace(/\{(\w+)\}/g, (match, key: string) => values[key] === undefined ? match : String(values[key]));
}
// Use only for interface copy. Creator content and signature payloads remain unchanged.
export const t = (source: string, values?: Record<string, string | number>) => translate(source, locale, values);
export const localeTag = () => locale === 'ru' ? 'ru-RU' : 'en-US';
const standardCriteria = new Set(['Matches the published brief', 'Specific, relevant and substantiated', 'Useful contribution for the stated goal']);
// Only the built-in rubric has a manual translation. Custom criteria retain the author's wording.
export const criterionLabel = (source: string) => standardCriteria.has(source) ? t(source) : source;
export function number(value: string | number) {
 // Keep raw onchain decimal strings exact; converting through Number loses base units.
 if (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value)) {
  const [whole, fraction] = value.split('.');
  const decimal = new Intl.NumberFormat(localeTag()).formatToParts(1.1).find(p => p.type === 'decimal')!.value;
  const trimmed = fraction?.replace(/0+$/, '');
  return BigInt(whole).toLocaleString(localeTag()) + (trimmed ? decimal + trimmed : '');
 }
 return Number(value).toLocaleString(localeTag(), { maximumFractionDigits: 18 });
}
export function noticeText(source: string, values?: Record<string, string>) {
  if (values) return t(source, Object.fromEntries(Object.entries(values).map(([key, value]) => [key, number(value)])));
  if (locale === 'en') return source;
  let match = source.match(/^Confirm (.+) in your wallet\.( Support Me covers gas\.)?$/);
  if (match) {
    const key = Object.keys(ru).find(key => key.toLowerCase() === match![1]);
    return t('Confirm {label} in your wallet.{gas}', { label: t(key ?? match[1]), gas: t(match[2] ?? '') });
  }
  match = source.match(/^(.+) is confirming on Monad\.$/);
  if (match) return t('{label} is confirming on Monad.', { label: t(match[1]) });
  match = source.match(/^(.+) confirmed\.( Gas covered by Support Me\.)?$/);
  if (match) return t('{label} confirmed.{gas}', { label: t(match[1]), gas: t(match[2] ?? '') });
  return t(source);
}
export function counted(value: number, english: string, forms: [string, string, string]) {
  if (locale === 'en') return `${value} ${english}${value === 1 ? '' : 's'}`;
  const mod100 = Math.abs(value) % 100, mod10 = Math.abs(value) % 10;
  return `${value} ${forms[mod100 >= 11 && mod100 <= 14 ? 2 : mod10 === 1 ? 0 : mod10 >= 2 && mod10 <= 4 ? 1 : 2]}`;
}
