import { useEffect, useMemo } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { creators, listings, categories } from '../data/mock';
import { useHubState, useHubActions } from '../providers/HubProvider';

const classes = {
  page: 'space-y-5',

  headerWrap: 'space-y-1',
  h1: 'text-2xl font-extrabold tracking-tight',
  subtitle: 'text-sm text-zinc-600',

  filtersGrid: 'grid gap-3 md:grid-cols-3',
  input:
    'md:col-span-1 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm',
  select: 'rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm',

  grid: 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3',

  card: 'overflow-hidden rounded-2xl border border-zinc-200 bg-white hover:bg-zinc-50',
  img: 'h-40 w-full object-cover',
  body: 'p-4',

  topRow: 'flex flex-wrap items-center justify-between gap-2',
  title: 'text-base font-extrabold tracking-tight',
  badge:
    'rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-xs font-semibold',

  desc: 'mt-1 text-sm text-zinc-600',

  bottomRow: 'mt-3 flex items-center justify-between text-sm',
  price: 'font-extrabold',
  creator: 'text-zinc-600',
};

const creatorByHandle = Object.fromEntries(creators.map((c) => [c.handle, c]));

const priceText = (listing) => {
  if (listing.priceType === 'fixed') return `$${listing.priceMin}`;
  if (listing.priceType === 'starting_at') return `From $${listing.priceMin}`;
  if (listing.priceType === 'range')
    return `$${listing.priceMin}–$${listing.priceMax}`;
  return '';
};

const getListingHaystack = (listing, creator) => {
  return [
    listing.title,
    listing.short,
    listing.category,
    ...(listing.tags || []),
    creator?.displayName || '',
  ]
    .join(' ')
    .toLowerCase();
};

const MarketListingCard = (props) => {
  const { listing, creator } = props;

  return (
    <Link to={`/listing/${listing.id}`} className={classes.card}>
      <img src={listing.preview} alt='' className={classes.img} />

      <div className={classes.body}>
        <div className={classes.topRow}>
          <div className={classes.title}>{listing.title}</div>
          <span className={classes.badge}>{listing.type}</span>
        </div>

        <p className={classes.desc}>{listing.short}</p>

        <div className={classes.bottomRow}>
          <span className={classes.price}>{priceText(listing)}</span>
          <span className={classes.creator}>
            {creator?.displayName ?? listing.creatorHandle}
          </span>
        </div>
      </div>
    </Link>
  );
};

const Market = () => {
  const { filters } = useHubState();
  const { setFilters } = useHubActions();
  const { search } = useLocation();

  useEffect(() => {
    const q = new URLSearchParams(search);
    const cat = q.get('cat');
    if (cat) setFilters({ category: cat });
  }, [search, setFilters]);

  const filtered = useMemo(() => {
    const s = filters.q.trim().toLowerCase();

    return listings.filter((l) => {
      if (filters.type !== 'all' && l.type !== filters.type) return false;
      if (filters.category !== 'all' && l.category !== filters.category)
        return false;

      if (!s) return true;

      const c = creatorByHandle[l.creatorHandle];
      return getListingHaystack(l, c).includes(s);
    });
  }, [filters]);

  return (
    <div className={classes.page}>
      <div className={classes.headerWrap}>
        <h1 className={classes.h1}>Market</h1>
        <p className={classes.subtitle}>
          Digital packs + commission offerings.
        </p>
      </div>

      <div className={classes.filtersGrid}>
        <input
          className={classes.input}
          value={filters.q}
          onChange={(e) => setFilters({ q: e.target.value })}
          placeholder='Search listings...'
        />

        <select
          className={classes.select}
          value={filters.type}
          onChange={(e) => setFilters({ type: e.target.value })}
        >
          <option value='all'>All types</option>
          <option value='digital'>Digital</option>
          <option value='commission'>Commission</option>
        </select>

        <select
          className={classes.select}
          value={filters.category}
          onChange={(e) => setFilters({ category: e.target.value })}
        >
          <option value='all'>All categories</option>
          {categories.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className={classes.grid}>
        {filtered.map((l) => {
          const c = creatorByHandle[l.creatorHandle];
          return <MarketListingCard key={l.id} listing={l} creator={c} />;
        })}
      </div>
    </div>
  );
};

export default Market;
