import { useEffect, useMemo } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { creators, listings, categories } from '../data/mock';
import { useHubState, useHubActions } from "../providers/HubProvider";

const creatorByHandle = Object.fromEntries(creators.map((c) => [c.handle, c]));

function priceText(listing) {
  if (listing.priceType === 'fixed') return `$${listing.priceMin}`;
  if (listing.priceType === 'starting_at') return `From $${listing.priceMin}`;
  if (listing.priceType === 'range')
    return `$${listing.priceMin}–$${listing.priceMax}`;
  return '';
}

const Market = () => {
  const { filters } = useHubState();
  const { setFilters } = useHubActions();
  const { search } = useLocation();

  useEffect(() => {
    const q = new URLSearchParams(search);
    const cat = q.get('cat');
    if (cat) setFilters({ category: cat });
  }, [search]);

  const filtered = useMemo(() => {
    const s = filters.q.trim().toLowerCase();
    return listings.filter((l) => {
      if (filters.type !== 'all' && l.type !== filters.type) return false;
      if (filters.category !== 'all' && l.category !== filters.category)
        return false;

      if (!s) return true;
      const c = creatorByHandle[l.creatorHandle];
      const hay = [
        l.title,
        l.short,
        l.category,
        ...(l.tags || []),
        c?.displayName || '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(s);
    });
  }, [filters]);

  return (
    <div className='space-y-5'>
      <div>
        <h1 className='text-2xl font-extrabold tracking-tight'>Market</h1>
        <p className='mt-1 text-sm text-zinc-600'>
          Digital packs + commission offerings.
        </p>
      </div>

      <div className='grid gap-3 md:grid-cols-3'>
        <input
          className='md:col-span-1 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm'
          value={filters.q}
          onChange={(e) => setFilters({ q: e.target.value })}
          placeholder='Search listings...'
        />

        <select
          className='rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm'
          value={filters.type}
          onChange={(e) => setFilters({ type: e.target.value })}
        >
          <option value='all'>All types</option>
          <option value='digital'>Digital</option>
          <option value='commission'>Commission</option>
        </select>

        <select
          className='rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm'
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

      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
        {filtered.map((l) => {
          const c = creatorByHandle[l.creatorHandle];
          return (
            <Link
              key={l.id}
              to={`/listing/${l.id}`}
              className='overflow-hidden rounded-2xl border border-zinc-200 bg-white hover:bg-zinc-50'
            >
              <img
                src={l.preview}
                alt=''
                className='h-40 w-full object-cover'
              />
              <div className='p-4'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <div className='text-base font-extrabold tracking-tight'>
                    {l.title}
                  </div>
                  <span className='rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-xs font-semibold'>
                    {l.type}
                  </span>
                </div>
                <p className='mt-1 text-sm text-zinc-600'>{l.short}</p>

                <div className='mt-3 flex items-center justify-between text-sm'>
                  <span className='font-extrabold'>{priceText(l)}</span>
                  <span className='text-zinc-600'>
                    {c?.displayName ?? l.creatorHandle}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default Market;
