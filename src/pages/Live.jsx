import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { creators } from '../data/mock';
import { CATEGORIES } from '../domain/catalog';

const categoryLabel = (key) =>
  CATEGORIES.find((c) => c.key === key)?.label ?? key;

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
      .filter((c) => {
        if (!s) return true;
        const hay = [
          c.displayName,
          c.handle,
          c.bio,
          ...(c.tags || []),
          ...(c.specialties || []).map(categoryLabel),
          c.live?.title || '',
        ]
          .join(' ')
          .toLowerCase();
        return hay.includes(s);
      })
      .sort((a, b) => (a.verified === b.verified ? 0 : a.verified ? -1 : 1));
  }, [q, platform]);

  return (
    <div className='space-y-5'>
      <div>
        <h1 className='text-2xl font-extrabold tracking-tight'>Live now</h1>
        <p className='mt-1 text-sm text-zinc-600'>
          Creators currently live on their channels. (Mock data for now.)
        </p>
      </div>

      <div className='grid gap-3 md:grid-cols-3'>
        <input
          className='md:col-span-2 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm'
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder='Search live creators (name, tags, title, specialties...)'
        />

        <select
          className='rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm'
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
        >
          <option value='all'>All platforms</option>
          <option value='twitch'>Twitch</option>
          <option value='youtube'>YouTube</option>
        </select>
      </div>

      {liveNow.length === 0 ? (
        <div className='rounded-2xl border border-zinc-200 bg-white p-6'>
          <div className='text-base font-extrabold tracking-tight'>
            No one is live right now
          </div>
          <p className='mt-2 text-sm text-zinc-600'>
            Once Twitch/YouTube integrations are added, this will update in real
            time.
          </p>
          <div className='mt-4 flex flex-wrap gap-3'>
            <Link
              to='/creators'
              className='rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold hover:bg-zinc-50'
            >
              Browse creators
            </Link>
            <Link
              to='/market'
              className='rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800'
            >
              Browse market
            </Link>
          </div>
        </div>
      ) : (
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {liveNow.map((c) => (
            <Link
              key={c.handle}
              to={`/creator/${c.handle}`}
              className='rounded-2xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50'
            >
              <div className='flex flex-wrap items-center gap-2'>
                <div className='text-base font-extrabold tracking-tight'>
                  {c.displayName}
                </div>

                {c.verified && (
                  <span className='rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-xs font-semibold'>
                    Verified
                  </span>
                )}

                <span className='rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700'>
                  Live
                </span>

                <span className='rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-xs font-semibold text-zinc-700'>
                  {c.live?.platform}
                </span>
              </div>

              <p className='mt-2 text-sm text-zinc-600'>{c.live?.title}</p>

              {!!c.specialties?.length && (
                <div className='mt-3 flex flex-wrap gap-2'>
                  {c.specialties.slice(0, 4).map((k) => (
                    <span
                      key={k}
                      className='rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700'
                    >
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
