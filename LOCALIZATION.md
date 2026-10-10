# Interface languages

The EN / RU control in the header changes the interface immediately and stores the choice in `support.locale` in localStorage. It also sets `html.lang`, localizes dates and numbers, and keeps open form drafts and selections intact. If storage is unavailable, switching still works for the current session.

Translations live in `src/locales/ru.ts`; the subscription and formatting helpers are in `src/i18n.ts`. Only interface copy is translated. Mission descriptions, participant work, creator-written rejection reasons, and AI explanations remain in their original language. Built-in AI criteria have a manually translated display label; their stored text is unchanged. Privy's own third-party dialogs may contain English labels.

Canonical category identifiers, payment mode numbers, numeric form values, signed messages and contract metadata are not localized. No translation service is called and no API credits are consumed for language switching.

Validation: `npm test`, `npm run test:e2e`, `npm run build`, `npx tsx scripts/production-locale-smoke.ts`.
