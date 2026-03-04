import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { creators } from '../data/mock';
import { CATEGORIES } from '../domain/catalog';

const classes = {
  page: 'space-y-5',

  headerWrap: 'space-y-1',
  h1: 'text-2xl font-extrabold tracking-tight',
  subtitle: 'text-sm text-zinc-600',

  filtersGrid: 'grid gap-3 md:grid-cols-3',
  input:
    'md:col-span-2 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm',
  select: 'rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm',

  emptyCard: 'rounded-2xl border border-zinc-200 bg-white p-6',
  emptyTitle: 'text-base font-extrabold tracking-tight',
  emptyText: 'mt-2 text-sm text-zinc-600',
  emptyActions: 'mt-4 flex flex-wrap gap-3',
  btnOutline:
    'rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold hover:bg-zinc-50',
  btnPrimary:
    'rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800',

  grid: 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3',
  card: 'rounded-2xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50',

  topRow: 'flex flex-wrap items-center gap-2',
  name: 'text-base font-extrabold tracking-tight',

  badgeBase: 'rounded-full border bg-white px-2 py-0.5 text-xs font-semibold',
  badgeDefault: 'border-zinc-200',
  badgeLive: 'border-rose-200 bg-rose-50 text-rose-700',
  badgePlatform: 'border-zinc-200 text-zinc-700',

  title: 'mt-2 text-sm text-zinc-600',

  specialtiesRow: 'mt-3 flex flex-wrap gap-2',
  specPill:
    'rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700',
};

const categoryLabel = (key) => {
  return CATEGORIES.find((c) => c.key === key)?.label ?? key;
};

const getLiveSearchHaystack = (c) => {
  return [
    c.displayName,
    c.handle,
    c.bio,
    ...(c.tags || []),
    ...(c.specialties || []).map(categoryLabel),
    c.live?.title || '',
  ]
    .join(' ')
    .toLowerCase();
};

const sortVerifiedFirst = (a, b) => {
  if (a.verified === b.verified) return 0;
  return a.verified ? -1 : 1;
};

const getBadgeClassName = (variant) => {
  if (variant === 'live') return `${classes.badgeBase} ${classes.badgeLive}`;
  if (variant === 'platform')
    return `${classes.badgeBase} ${classes.badgePlatform}`;
  return `${classes.badgeBase} ${classes.badgeDefault}`;
};

const Live = () => {
  const [q, setQ] = useState('');
  const [platform, setPlatform] = useState('all'); // all | twitch | youtube

  const liveNow = useMemo(() => {
    const s = q.trim().toLowerCase();

    return creators
      .filter((c) => c.live?.isLive)
      .filter((c) =>
        platform === 'all' ? true : c.live?.platform === platform,
      )
      .filter((c) => (s ? getLiveSearchHaystack(c).includes(s) : true))
      .sort(sortVerifiedFirst);
  }, [q, platform]);

  return (
    <div className={classes.page}>
      <div className={classes.headerWrap}>
        <h1 className={classes.h1}>Live now</h1>
        <p className={classes.subtitle}>
          Creators currently live on their channels. (Mock data for now.)
        </p>
      </div>

      <div className={classes.filtersGrid}>
        <input
          className={classes.input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder='Search live creators (name, tags, title, specialties...)'
        />

        <select
          className={classes.select}
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
        >
          <option value='all'>All platforms</option>
          <option value='twitch'>Twitch</option>
          <option value='youtube'>YouTube</option>
        </select>
      </div>

      {liveNow.length === 0 ? (
        <div className={classes.emptyCard}>
          <div className={classes.emptyTitle}>No one is live right now</div>
          <p className={classes.emptyText}>
            Once Twitch/YouTube integrations are added, this will update in real
            time.
          </p>

          <div className={classes.emptyActions}>
            <Link to='/creators' className={classes.btnOutline}>
              Browse creators
            </Link>
            <Link to='/market' className={classes.btnPrimary}>
              Browse market
            </Link>
          </div>
        </div>
      ) : (
        <div className={classes.grid}>
          {liveNow.map((c) => (
            <Link
              key={c.handle}
              to={`/creator/${c.handle}`}
              className={classes.card}
            >
              <div className={classes.topRow}>
                <div className={classes.name}>{c.displayName}</div>

                {c.verified && (
                  <span className={getBadgeClassName('default')}>Verified</span>
                )}

                <span className={getBadgeClassName('live')}>Live</span>

                <span className={getBadgeClassName('platform')}>
                  {c.live?.platform}
                </span>
              </div>

              <p className={classes.title}>{c.live?.title}</p>

              {!!c.specialties?.length && (
                <div className={classes.specialtiesRow}>
                  {c.specialties.slice(0, 4).map((k) => (
                    <span key={k} className={classes.specPill}>
                      {categoryLabel(k)}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default Live;
