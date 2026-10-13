import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Search, Users } from 'lucide-react';
import type { Contribution, Profile } from '../shared/model';
import { sameAddress, shortAddress } from '../shared/model';
import { t, useLocale } from './i18n';
import './mission-submissions.css';

const PAGE_SIZE = 10;
const filters = ['All work', 'To review', 'Rewarded', 'Other statuses'] as const;
type Filter = typeof filters[number];

export function MissionSubmissions({ entries, profiles, status, renderContribution }: {
  entries: Contribution[];
  profiles: Profile[];
  status: (entry: Contribution) => string;
  renderContribution: (entry: Contribution) => ReactNode;
}) {
  useLocale();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('All work');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<number>();
  const latest = useRef(entries); latest.current = entries;
  const identity = (entry: Contribution) => profiles.find(p => sameAddress(p.address, entry.contributor));
  const matches = (entry: Contribution, value: Filter) => value === 'All work' ||
    (value === 'To review' ? [0, 3].includes(entry.status) : value === 'Rewarded' ? entry.status === 1 : ![0, 1, 3].includes(entry.status));
  const query = search.trim().toLocaleLowerCase();
  const ordered = [...entries].sort((a, b) => b.id - a.id);
  const filtered = ordered.filter(entry => matches(entry, filter) && (!query ||
    [entry.id, entry.name, entry.text, entry.contributor, entry.socialUrl, identity(entry)?.name, identity(entry)?.username].join(' ').toLocaleLowerCase().includes(query)));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  useEffect(() => {
    const followHash = () => {
      const id = Number(/^#contribution-(\d+)$/.exec(window.location.hash)?.[1]);
      const index = [...latest.current].sort((a, b) => b.id - a.id).findIndex(entry => entry.id === id);
      if (index < 0) return;
      setFilter('All work'); setSearch(''); setPage(Math.floor(index / PAGE_SIZE)); setSelected(id);
    };
    followHash(); window.addEventListener('hashchange', followHash);
    return () => window.removeEventListener('hashchange', followHash);
  }, []);
  useEffect(() => {
    if (selected && window.location.hash === `#contribution-${selected}`)
      document.getElementById(`contribution-${selected}`)?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const changePage = (next: number) => { setPage(next); setSelected(undefined); };
  return <section className="mission-submissions" aria-label={t('Participant work')}>
    <div className="submissions-intro"><div><h2>{t('Participant work')} <span>{entries.length}</span></h2><p>{t('Open a submission to review the work and reward its author.')}</p></div><span className="submissions-private">{t('Only you can see this list')}</span></div>
    <label className="submissions-search"><Search size={18} aria-hidden="true"/><span className="visually-hidden">{t('Search participant work')}</span><input type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(0); setSelected(undefined); }} placeholder={t('Search by name, post or work text')}/></label>
    <div className="submissions-filters" role="group" aria-label={t('Filter participant work')}>{filters.map(value => <button key={value} type="button" aria-pressed={filter === value} onClick={() => { setFilter(value); setPage(0); setSelected(undefined); }}>{t(value)}<span>{entries.filter(entry => matches(entry, value)).length}</span></button>)}</div>
    {!visible.length ? <div className="submissions-empty"><Users size={32} aria-hidden="true"/><h3>{t(entries.length ? 'No matching submissions' : 'No submissions yet')}</h3><p>{t(entries.length ? 'Try another search or status filter.' : 'New work will appear here when participants submit it.')}</p>{!!entries.length && <button className="button secondary small" onClick={() => { setSearch(''); setFilter('All work'); setPage(0); }}>{t('Clear filters')}</button>}</div> : <>
      <div className="submission-column-labels" aria-hidden="true"><span>{t('Participant and work')}</span><span>{t('Status')}</span><span/></div>
      <div className="submission-rows">{visible.map(entry => {
        const profile = identity(entry), name = profile?.name || entry.name || shortAddress(entry.contributor);
        const expanded = selected === entry.id;
        return <Fragment key={entry.id}><button type="button" className={`submission-row ${expanded ? 'selected' : ''}`} aria-expanded={expanded} aria-controls={`submission-detail-${entry.id}`} onClick={() => setSelected(expanded ? undefined : entry.id)}>
          <span className="submission-person"><span className="avatar">{profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" referrerPolicy="no-referrer" loading="lazy"/> : name.slice(0, 2).toUpperCase()}</span><span className="submission-preview"><strong>{name}<small>#{entry.id}</small></strong><span>{entry.text || entry.socialUrl || t('Open submission')}</span></span></span>
          <span className={`pill ${entry.status === 1 ? 'green' : ''}`}>{t(status(entry))}</span><ChevronDown size={18} aria-hidden="true"/>
        </button>{expanded && <div id={`submission-detail-${entry.id}`} className="submission-expanded">{renderContribution(entry)}</div>}</Fragment>;
      })}</div>
      <nav className="submissions-pagination" aria-label={t('Participant work pages')}><span aria-live="polite">{t('Showing {from}–{to} of {total}', { from: current * PAGE_SIZE + 1, to: Math.min((current + 1) * PAGE_SIZE, filtered.length), total: filtered.length })}</span><div><button type="button" aria-label={t('Previous page')} disabled={current === 0} onClick={() => changePage(current - 1)}><ChevronLeft size={18}/></button><span>{current + 1} / {pages}</span><button type="button" aria-label={t('Next page')} disabled={current + 1 >= pages} onClick={() => changePage(current + 1)}><ChevronRight size={18}/></button></div></nav>
    </>}
  </section>;
}
