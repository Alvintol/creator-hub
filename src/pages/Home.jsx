import { creators, listings } from '../data/mock';
import { Link, useNavigate } from 'react-router-dom';
import { VIDEO_SUBTYPES, CATEGORIES } from '../domain/catalog';

const classes = {
  page: 'space-y-10',

  section: 'space-y-3',
  headerRow: 'flex items-baseline justify-between gap-4',
  h2: 'text-xl font-extrabold tracking-tight',
  linkSubtle: 'text-sm font-semibold text-zinc-600 hover:text-zinc-900',

  cardLg: 'rounded-3xl border border-zinc-200 bg-white p-6',
  card: 'rounded-2xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50',
  cardLink:
    'group overflow-hidden rounded-2xl border border-zinc-200 bg-white hover:bg-zinc-50',

  btnPrimary:
    'rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800',
  btnOutline:
    'rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold hover:bg-zinc-50',

  chip: 'rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-200',
  chipSm:
    'rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-200',

  badgeBase: 'rounded-full border bg-white px-2 py-0.5 text-xs font-semibold',
  badgeDefault: 'border-zinc-200',
  badgeFeatured: 'border-amber-200 bg-amber-50 text-amber-800',
  badgeLive: 'border-rose-200 bg-rose-50 text-rose-700',

  heroMax: 'max-w-3xl',
  heroH1: 'text-3xl font-extrabold tracking-tight',
  heroP: 'mt-2 text-zinc-600',
  heroActions: 'mt-5 flex flex-wrap gap-3',
  heroChips: 'mt-6 flex flex-wrap items-center gap-2',

  gridCats: 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3',
  catTop: 'flex items-center justify-between',
  catTitle: 'text-base font-extrabold tracking-tight',
  catIcon: 'text-xl',
  catDesc: 'mt-1 text-sm text-zinc-600',
  catSubLinks: 'mt-3 flex flex-wrap gap-2',

  grid: 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3',

  featuredMedia: 'relative',
  featuredImg: 'h-40 w-full object-cover',
  featuredBadges: 'absolute left-3 top-3 flex gap-2',

  featuredBody: 'p-4',
  featuredTop: 'flex items-start justify-between gap-3',
  featuredTitleWrap: 'min-w-0',
  featuredTitle: 'truncate text-base font-extrabold tracking-tight',
  featuredMeta: 'mt-1 text-sm text-zinc-600',
  featuredPrice: 'shrink-0 text-sm font-extrabold',
  featuredShort: 'mt-2 line-clamp-2 text-sm text-zinc-600',
  featuredBy: 'mt-3 text-sm text-zinc-600',
  featuredByName: 'font-semibold text-zinc-900',

  liveRow: 'flex flex-wrap items-center gap-2',
  liveTitle: 'text-base font-extrabold tracking-tight',
  liveDesc: 'mt-2 text-sm text-zinc-600',
  liveMeta: 'mt-2 text-xs text-zinc-500',

  emptyText: 'text-sm text-zinc-600',
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

const categoryLabel = (key) => {
  return CATEGORIES.find((c) => c.key === key)?.label ?? key;
};

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

const getBadgeClassName = (variant) => {
  if (variant === 'featured')
    return `${classes.badgeBase} ${classes.badgeFeatured}`;
  if (variant === 'live') return `${classes.badgeBase} ${classes.badgeLive}`;
  return `${classes.badgeBase} ${classes.badgeDefault}`;
};

const formatVideoSubtype = (key) => {
  return key === 'long-form' ? 'Long Form' : 'Short Form';
};

const byHandle = Object.fromEntries(creators.map((c) => [c.handle, c]));

const SectionHeader = (props) => {
  const { title, to, linkText } = props;

  return (
    <div className={classes.headerRow}>
      <h2 className={classes.h2}>{title}</h2>
      <Link to={to} className={classes.linkSubtle}>
        {linkText}
      </Link>
    </div>
  );
};

const HeroSection = () => {
  return (
    <section className={classes.cardLg}>
      <div className={classes.heroMax}>
        <h1 className={classes.heroH1}>
          CreatorHub — assets & services, in one trusted place.
        </h1>
        <p className={classes.heroP}>
          Find emote artists, overlay designers, PNG/VTuber creators, riggers,
          editors, and audio help — with clear categories and “Live now”
          discovery.
        </p>
      </div>

      <div className={classes.heroActions}>
        <Link to='/market' className={classes.btnPrimary}>
          Browse market
        </Link>
        <Link to='/creators' className={classes.btnOutline}>
          Find creators
        </Link>
        <Link to='/live' className={classes.btnOutline}>
          Live now
        </Link>
      </div>

      <div className={classes.heroChips}>
        <Link
          to='/market?cat=video-editing&video=long-form'
          className={classes.chip}
        >
          Long form edits
        </Link>
        <Link
          to='/market?cat=video-editing&video=short-form'
          className={classes.chip}
        >
          Short form edits
        </Link>
        <Link to='/market?cat=vtuber-rigging' className={classes.chip}>
          PNG/VTuber rigging help
        </Link>
        <Link to='/market?cat=audio-tech-help' className={classes.chip}>
          Audio tech help
        </Link>
      </div>
    </section>
  );
};

const CategoriesSection = (props) => {
  const { navigate } = props;

  const onVideoClick = (e, key) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/market?cat=video-editing&video=${key}`);
  };

  return (
    <section className={classes.section}>
      <SectionHeader
        title='Browse categories'
        to='/market'
        linkText='View all →'
      />

      <div className={classes.gridCats}>
        {CATEGORIES.map((cat) => (
          <Link
            key={cat.key}
            to={`/market?cat=${cat.key}`}
            className={classes.card}
          >
            <div className={classes.catTop}>
              <div className={classes.catTitle}>{cat.label}</div>
              <div className={classes.catIcon}>{ICONS[cat.key] ?? '✨'}</div>
            </div>

            <p className={classes.catDesc}>
              Explore {cat.label.toLowerCase()} offerings.
            </p>

            {cat.key === 'video-editing' && (
              <div className={classes.catSubLinks}>
                {VIDEO_SUBTYPES.map((v) => (
                  <button
                    key={v.key}
                    type='button'
                    className={classes.chipSm}
                    onClick={(e) => onVideoClick(e, v.key)}
                  >
                    {formatVideoSubtype(v.key)}
                  </button>
                ))}
              </div>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
};

const FeaturedListingCard = (props) => {
  const { listing } = props;
  const c = byHandle[listing.creatorHandle];

  const videoSuffix =
    listing.category === 'video-editing' && listing.videoSubtype
      ? ` • ${formatVideoSubtype(listing.videoSubtype)}`
      : '';

  return (
    <Link to={`/listing/${listing.id}`} className={classes.cardLink}>
      <div className={classes.featuredMedia}>
        <img
          src={listing.preview}
          alt=''
          className={classes.featuredImg}
          loading='lazy'
        />

        <div className={classes.featuredBadges}>
          <span className={getBadgeClassName('default')}>
            {offeringPill(listing.offeringType)}
          </span>
          <span className={getBadgeClassName('featured')}>Featured</span>
        </div>
      </div>

      <div className={classes.featuredBody}>
        <div className={classes.featuredTop}>
          <div className={classes.featuredTitleWrap}>
            <div className={classes.featuredTitle}>{listing.title}</div>
            <div className={classes.featuredMeta}>
              {categoryLabel(listing.category)}
              {videoSuffix}
            </div>
          </div>

          <div className={classes.featuredPrice}>{priceText(listing)}</div>
        </div>

        <p className={classes.featuredShort}>{listing.short}</p>

        <div className={classes.featuredBy}>
          by{' '}
          <span className={classes.featuredByName}>
            {c?.displayName ?? listing.creatorHandle}
          </span>
        </div>
      </div>
    </Link>
  );
};

const FeaturedSection = (props) => {
  const { featuredListings } = props;

  return (
    <section className={classes.section}>
      <SectionHeader title='Featured' to='/market' linkText='Browse market →' />

      <div className={classes.grid}>
        {featuredListings.map((l) => (
          <FeaturedListingCard key={l.id} listing={l} />
        ))}
      </div>
    </section>
  );
};

const LiveCreatorCard = (props) => {
  const { creator } = props;

  return (
    <Link to={`/creator/${creator.handle}`} className={classes.card}>
      <div className={classes.liveRow}>
        <div className={classes.liveTitle}>{creator.displayName}</div>

        {creator.verified && (
          <span className={getBadgeClassName('default')}>Verified</span>
        )}

        <span className={getBadgeClassName('live')}>Live</span>
      </div>

      <p className={classes.liveDesc}>{creator.live?.title}</p>
      <p className={classes.liveMeta}>Platform: {creator.live?.platform}</p>
    </Link>
  );
};

const LiveNowSection = (props) => {
  const { liveNow } = props;

  return (
    <section className={classes.section}>
      <SectionHeader title='Live now' to='/live' linkText='View all →' />

      {liveNow.length === 0 ? (
        <p className={classes.emptyText}>No one is live right now.</p>
      ) : (
        <div className={classes.grid}>
          {liveNow.slice(0, 6).map((c) => (
            <LiveCreatorCard key={c.handle} creator={c} />
          ))}
        </div>
      )}
    </section>
  );
};

const Home = () => {
  const navigate = useNavigate();

  const liveNow = creators.filter((c) => c.live?.isLive);

  const featured = listings.filter((l) => l.featured);
  const featuredListings = featured.length
    ? featured.slice(0, 6)
    : listings.slice(0, 6);

  return (
    <div className={classes.page}>
      <HeroSection />
      <CategoriesSection navigate={navigate} />
      <FeaturedSection featuredListings={featuredListings} />
      <LiveNowSection liveNow={liveNow} />
    </div>
  );
};

export default Home;
