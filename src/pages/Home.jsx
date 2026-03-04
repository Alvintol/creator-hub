import { creators, listings } from '../data/mock';
import { Link, useNavigate } from 'react-router-dom';
import { VIDEO_SUBTYPES, CATEGORIES } from '../domain/catalog';

const categoryLabel = (key) =>
  CATEGORIES.find((c) => c.key === key)?.label ?? key;

const offeringPill = (offeringType) => {
  if (offeringType === 'digital') return 'Digital';
  if (offeringType === 'commission') return 'Commission';
  if (offeringType === 'service') return 'Service';
  return offeringType ?? '';
};

const priceText = (l) => {
  if (!l) return '';
  if (l.priceType === 'fixed') return `$${l.priceMin}`;
  if (l.priceType === 'starting_at') return `From $${l.priceMin}`;
  if (l.priceType === 'range') return `$${l.priceMin}–$${l.priceMax}`;
  return '';
};

const ICONS = {
  emotes: '😊',
  overlays: '🧩',
  'pngtuber-models': '🖼️',
  'vtuber-models': '🧍',
  'vtuber-rigging': '🧵',
  'video-editing': '🎬',
  'audio-tech-help': '🎚️',
};

const byHandle = Object.fromEntries(creators.map((c) => [c.handle, c]));

const Home = () => {
  const navigate = useNavigate();
  const liveNow = creators.filter((c) => c.live?.isLive);
  const featured = listings.filter((l) => l.featured);
  const featuredListings = featured.length
    ? featured.slice(0, 6)
    : listings.slice(0, 6);

  return (
    <div className='space-y-10'>
      {/* HERO */}
      <section className='rounded-3xl border border-zinc-200 bg-white p-6'>
        <div className='max-w-3xl'>
          <h1 className='text-3xl font-extrabold tracking-tight'>
            CreatorHub — assets & services, in one trusted place.
          </h1>
          <p className='mt-2 text-zinc-600'>
            Find emote artists, overlay designers, PNG/VTuber creators, riggers,
            editors, and audio help — with clear categories and “Live now”
            discovery.
          </p>
        </div>

        <div className='mt-5 flex flex-wrap gap-3'>
          <Link
            to='/market'
            className='rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800'
          >
            Browse market
          </Link>
          <Link
            to='/creators'
            className='rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold hover:bg-zinc-50'
          >
            Find creators
          </Link>
          <Link
            to='/live'
            className='rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold hover:bg-zinc-50'
          >
            Live now
          </Link>
        </div>

        {/* quick chips */}
        <div className='mt-6 flex flex-wrap items-center gap-2'>
          <Link
            to='/market?cat=video-editing&video=long-form'
            className='rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-200'
          >
            Long form edits
          </Link>
          <Link
            to='/market?cat=video-editing&video=short-form'
            className='rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-200'
          >
            Short form edits
          </Link>
          <Link
            to='/market?cat=vtuber-rigging'
            className='rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-200'
          >
            PNG/VTuber rigging help
          </Link>
          <Link
            to='/market?cat=audio-tech-help'
            className='rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-200'
          >
            Audio tech help
          </Link>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className='space-y-3'>
        <div className='flex items-baseline justify-between gap-4'>
          <h2 className='text-xl font-extrabold tracking-tight'>
            Browse categories
          </h2>
          <Link
            to='/market'
            className='text-sm font-semibold text-zinc-600 hover:text-zinc-900'
          >
            View all →
          </Link>
        </div>

        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.key}
              to={`/market?cat=${cat.key}`}
              className='rounded-2xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50'
            >
              <div className='flex items-center justify-between'>
                <div className='text-base font-extrabold tracking-tight'>
                  {cat.label}
                </div>
                <div className='text-xl'>{ICONS[cat.key] ?? '✨'}</div>
              </div>
              <p className='mt-1 text-sm text-zinc-600'>
                Explore {cat.label.toLowerCase()} offerings.
              </p>

              {/* Special: show video sub-links */}
              {cat.key === 'video-editing' && (
                <div className='mt-3 flex flex-wrap gap-2'>
                  {VIDEO_SUBTYPES.map((v) => (
                    <button
                      key={v.key}
                      type='button'
                      className='rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-200'
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        navigate(`/market?cat=video-editing&video=${v.key}`);
                      }}
                    >
                      {v.key === 'long-form' ? 'Long Form' : 'Short Form'}
                    </button>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      </section>

      {/* FEATURED LISTINGS */}
      <section className='space-y-3'>
        <div className='flex items-baseline justify-between gap-4'>
          <h2 className='text-xl font-extrabold tracking-tight'>Featured</h2>
          <Link
            to='/market'
            className='text-sm font-semibold text-zinc-600 hover:text-zinc-900'
          >
            Browse market →
          </Link>
        </div>

        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {featuredListings.map((l) => {
            const c = byHandle[l.creatorHandle];
            return (
              <Link
                key={l.id}
                to={`/listing/${l.id}`}
                className='group overflow-hidden rounded-2xl border border-zinc-200 bg-white hover:bg-zinc-50'
              >
                <div className='relative'>
                  <img
                    src={l.preview}
                    alt=''
                    className='h-40 w-full object-cover'
                    loading='lazy'
                  />
                  <div className='absolute left-3 top-3 flex gap-2'>
                    <span className='rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-xs font-semibold'>
                      {offeringPill(l.offeringType)}
                    </span>
                    <span className='rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800'>
                      Featured
                    </span>
                  </div>
                </div>

                <div className='p-4'>
                  <div className='flex items-start justify-between gap-3'>
                    <div className='min-w-0'>
                      <div className='truncate text-base font-extrabold tracking-tight'>
                        {l.title}
                      </div>
                      <div className='mt-1 text-sm text-zinc-600'>
                        {categoryLabel(l.category)}
                        {l.category === 'video-editing' && l.videoSubtype
                          ? ` • ${l.videoSubtype === 'long-form' ? 'Long Form' : 'Short Form'}`
                          : ''}
                      </div>
                    </div>
                    <div className='shrink-0 text-sm font-extrabold'>
                      {priceText(l)}
                    </div>
                  </div>

                  <p className='mt-2 line-clamp-2 text-sm text-zinc-600'>
                    {l.short}
                  </p>

                  <div className='mt-3 text-sm text-zinc-600'>
                    by{' '}
                    <span className='font-semibold text-zinc-900'>
                      {c?.displayName ?? l.creatorHandle}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* LIVE NOW */}
      <section className='space-y-3'>
        <div className='flex items-baseline justify-between gap-4'>
          <h2 className='text-xl font-extrabold tracking-tight'>Live now</h2>
          <Link
            to='/live'
            className='text-sm font-semibold text-zinc-600 hover:text-zinc-900'
          >
            View all →
          </Link>
        </div>

        {liveNow.length === 0 ? (
          <p className='text-sm text-zinc-600'>No one is live right now.</p>
        ) : (
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            {liveNow.slice(0, 6).map((c) => (
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
                </div>
                <p className='mt-2 text-sm text-zinc-600'>{c.live?.title}</p>
                <p className='mt-2 text-xs text-zinc-500'>
                  Platform: {c.live?.platform}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Home;
