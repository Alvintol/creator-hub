import { useParams, Link } from 'react-router-dom';
import { creators, listings } from '../data/mock';

const classes = {
  notFoundWrap: 'space-y-4',
  h1: 'text-2xl font-extrabold tracking-tight',
  backBtn:
    'rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold hover:bg-zinc-50',

  page: 'space-y-6',
  backLink: 'text-sm font-semibold text-zinc-600 hover:text-zinc-900',

  grid: 'grid gap-6 lg:grid-cols-2',
  img: 'w-full rounded-3xl border border-zinc-200 object-cover',

  rightCol: 'space-y-4',
  titleRow: 'flex flex-wrap items-center gap-2',
  badge:
    'rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-xs font-semibold',
  desc: 'text-zinc-600',

  priceRow: 'flex items-center justify-between',
  price: 'text-xl font-extrabold',
  creatorLink: 'text-sm font-semibold text-zinc-600 hover:text-zinc-900',

  chips: 'flex flex-wrap gap-2',
  chip: 'rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700',

  ctaBox: 'rounded-2xl border border-zinc-200 bg-zinc-50 p-4',
  ctaTitle: 'font-semibold',
  ctaText: 'mt-1 text-sm text-zinc-600',
  ctaLink:
    'mt-3 inline-flex rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800',
};

const priceText = (listing) => {
  if (listing.priceType === 'fixed') return `$${listing.priceMin}`;
  if (listing.priceType === 'starting_at') return `From $${listing.priceMin}`;
  if (listing.priceType === 'range')
    return `$${listing.priceMin}–$${listing.priceMax}`;
  return '';
};

const ListingNotFound = () => {
  return (
    <div className={classes.notFoundWrap}>
      <h1 className={classes.h1}>Listing not found</h1>
      <Link to='/market' className={classes.backBtn}>
        Back to market
      </Link>
    </div>
  );
};

const Listing = () => {
  const { id } = useParams();
  const listing = listings.find((l) => l.id === id);

  if (!listing) return <ListingNotFound />;

  const creator = creators.find((c) => c.handle === listing.creatorHandle);

  return (
    <div className={classes.page}>
      <Link to='/market' className={classes.backLink}>
        ← Back
      </Link>

      <div className={classes.grid}>
        <img src={listing.preview} alt='' className={classes.img} />

        <div className={classes.rightCol}>
          <div className={classes.titleRow}>
            <h1 className={classes.h1}>{listing.title}</h1>
            <span className={classes.badge}>{listing.type}</span>
          </div>

          <p className={classes.desc}>{listing.short}</p>

          <div className={classes.priceRow}>
            <div className={classes.price}>{priceText(listing)}</div>

            {creator && (
              <Link
                to={`/creator/${creator.handle}`}
                className={classes.creatorLink}
              >
                by {creator.displayName} →
              </Link>
            )}
          </div>

          <div className={classes.chips}>
            <span className={classes.chip}>{listing.category}</span>

            {(listing.tags || []).map((t) => (
              <span key={t} className={classes.chip}>
                {t}
              </span>
            ))}
          </div>

          <div className={classes.ctaBox}>
            <div className={classes.ctaTitle}>Checkout coming soon</div>
            <p className={classes.ctaText}>
              v0 focuses on discovery. Payments + safe delivery will come after.
            </p>

            {creator && (
              <Link
                to={`/creator/${creator.handle}`}
                className={classes.ctaLink}
              >
                Contact creator
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Listing;
