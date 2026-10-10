import { setLocale, useLocale } from './i18n';

export default function LanguageToggle() {
  const locale = useLocale();
  return <div className="language-toggle" role="group" aria-label={locale === 'ru' ? 'Язык интерфейса' : 'Interface language'}>
    <button type="button" lang="en" aria-label="English" aria-pressed={locale === 'en'} onClick={() => setLocale('en')}>EN</button>
    <button type="button" lang="ru" aria-label="Русский" aria-pressed={locale === 'ru'} onClick={() => setLocale('ru')}>RU</button>
  </div>;
}
