import { useParams, Link } from 'react-router-dom';
import { creators, listings } from '../data/mock';

const classes = {
  container: 'space-y-8',

  backLink: 'text-sm font-semibold text-zinc-600 hover:text-zinc-900',

  notFoundWrap: 'space-y-4',
  h1: 'text-2xl font-extrabold tracking-tight',
  h2: 'text-xl font-extrabold tracking-tight',

  card: 'rounded-3xl border border-zinc-200 bg-white p-6',

  titleRow: 'flex flex-wrap items-center gap-2',
  bio: 'mt-2 text-zinc-600',

  badgeBase: 'rounded-full border bg-white px-2 py-0.5 text-xs font-semibold',
  badgeVerified: 'border-zinc-200',
  badgeLive: 'border-rose-200 bg-rose-50 text-rose-700',

  linksRow: 'mt-4 flex flex-wrap gap-2',
  btnPrimary:
    'rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800',
  btnOutline:
    'rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold hover:bg-zinc-50',

  liveLine: 'mt-4 text-sm text-zinc-600',
  liveLabel: 'font-semibold',

  listingsSection: 'space-y-3',
  emptyText: 'text-sm text-zinc-600',
  grid: 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3',

  listingCard:
    'overflow-hidden rounded-2xl border border-zinc-200 bg-white hover:bg-zinc-50',
  listingImg: 'h-40 w-full object-cover',
  listingBody: 'p-4',
  listingTitle: 'text-base font-extrabold tracking-tight',
  listingDesc: 'mt-1 text-sm text-zinc-600',
  listingMeta: 'mt-3 flex items-center justify-between text-sm',
  listingMetaLeft: 'font-extrabold',
  listingMetaRight: 'text-zinc-600',
};

const getCreatorByHandle = (handle) => {
  return creators.find((c) => c.handle === handle);
};

const getListingsByCreatorHandle = (handle) => {
  return listings.filter((l) => l.creatorHandle === handle);
};

const getBadgeClassName = (variant) => {
  if (variant === 'live') return `${classes.badgeBase} ${classes.badgeLive}`;
  return `${classes.badgeBase} ${classes.badgeVerified}`;
};

const CreatorLinkButton = (props) => {
  const { href, label, variant = 'outline' } = props;

  const className =
    variant === 'primary' ? classes.btnPrimary : classes.btnOutline;

  return (
    <a className={className} target='_blank' rel='noreferrer' href={href}>
      {label}
    </a>
  );
};

const CreatorListingLink = (props) => {
  const { listing } = props;

  return (
    <Link to={`/listing/${listing.id}`} className={classes.listingCard}>
      <img src={listing.preview} alt='' className={classes.listingImg} />
      <div className={classes.listingBody}>
        <div className={classes.listingTitle}>{listing.title}</div>
        <p className={classes.listingDesc}>{listing.short}</p>
        <div className={classes.listingMeta}>
          <span className={classes.listingMetaLeft}>{listing.type}</span>
          <span className={classes.listingMetaRight}>{listing.category}</span>
        </div>
      </div>
    </Link>
  );
};

const CreatorNotFound = () => {
  return (
    <div className={classes.notFoundWrap}>
      <h1 className={classes.h1}>Creator not found</h1>
      <Link to='/creators' className={classes.btnOutline}>
        Back to creators
      </Link>
    </div>
  );
};

const CreatorProfile = () => {
  const { handle } = useParams();

  const creator = getCreatorByHandle(handle);
  const creatorListings = getListingsByCreatorHandle(handle);

  if (!creator) return <CreatorNotFound />;

  return (
    <div className={classes.container}>
      <Link to='/creators' className={classes.backLink}>
        ← Back
      </Link>

      <section className={classes.card}>
        <div className={classes.titleRow}>
          <h1 className={classes.h1}>{creator.displayName}</h1>

          {creator.verified && (
            <span className={getBadgeClassName('verified')}>Verified</span>
          )}

          {creator.live?.isLive && (
            <span className={getBadgeClassName('live')}>Live</span>
          )}
        </div>

        <p className={classes.bio}>{creator.bio}</p>

        <div className={classes.linksRow}>
          {creator.links?.twitch && (
            <CreatorLinkButton
              href={creator.links.twitch}
              label='Twitch'
              variant='primary'
            />
          )}
          {creator.links?.youtube && (
            <CreatorLinkButton href={creator.links.youtube} label='YouTube' />
          )}
          {creator.links?.discord && (
            <CreatorLinkButton href={creator.links.discord} label='Discord' />
          )}
          {creator.links?.website && (
            <CreatorLinkButton href={creator.links.website} label='Website' />
          )}
        </div>

        {creator.live?.isLive && creator.live?.title && (
          <p className={classes.liveLine}>
            <span className={classes.liveLabel}>Live:</span>{' '}
            {creator.live.title}
          </p>
        )}
      </section>

      <section className={classes.listingsSection}>
        <h2 className={classes.h2}>Listings</h2>

        {creatorListings.length === 0 ? (
          <p className={classes.emptyText}>No listings yet.</p>
        ) : (
          <div className={classes.grid}>
            {creatorListings.map((l) => (
              <CreatorListingLink key={l.id} listing={l} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default CreatorProfile;
