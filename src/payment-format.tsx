import { Crown, FileCheck2, Users, Bug, Ticket, Sparkles, Check } from 'lucide-react';
import { paymentModes } from '../shared/model';
import { t } from './i18n';

const icons = [Crown, FileCheck2, Users, Bug, Ticket, Sparkles, Ticket];
const descriptions = ['You choose the best contributions.', 'Reserve a place, then deliver your report.', 'Choose a contributor before work starts.', 'Reward confirmed, reproducible bugs.', 'Random winners from verified replies.', 'A published rubric determines the winners.', 'Random winners from eligible participants.'];
export function PaymentFormat({ value, options, aiAvailable, onChange }: { value: number; options: number[]; aiAvailable: boolean; onChange: (value: number) => void }) {
 return <fieldset className="payment-format"><legend>{t('Payment format')}</legend><div className="payment-options">{options.map(mode => {
  const Icon = icons[mode];
  return <button type="button" key={mode} data-payment-mode={mode} aria-pressed={value === mode} disabled={mode === 5 && !aiAvailable} onClick={() => onChange(mode)} className="payment-option"><Icon size={24} aria-hidden="true"/><span><strong>{t(paymentModes[mode])}</strong><small>{t(descriptions[mode])}{mode === 5 && !aiAvailable ? t(' · temporarily unavailable') : ''}</small></span><span className="option-check" aria-hidden="true">{value === mode && <Check size={12}/>}</span></button>;
 })}</div></fieldset>;
}
