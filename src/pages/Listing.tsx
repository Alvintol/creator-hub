import { Link, useParams } from "react-router-dom";
import { creators, listings, type Creator, type Listing } from "../data/mock";

const classes = {
  notFoundWrap: "space-y-4",
  h1: "text-2xl font-extrabold tracking-tight",
  backBtn: "btnOutline",

  page: "space-y-6",
  backLink: "text-sm font-semibold text-zinc-600 hover:text-zinc-900",

  grid: "grid gap-6 lg:grid-cols-2",
  img: "w-full rounded-3xl border border-zinc-200 object-cover",

  rightCol: "space-y-4",
  titleRow: "flex flex-wrap items-center gap-2",
  badge:
    "rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-xs font-semibold",
  desc: "text-zinc-600",

  priceRow: "flex items-center justify-between",
  price: "text-xl font-extrabold",
  creatorLink: "text-sm font-semibold text-zinc-600 hover:text-zinc-900",

  chips: "flex flex-wrap gap-2",
  chip: "chip",

  ctaBox: "rounded-2xl border border-zinc-200 bg-zinc-50 p-4",
  ctaTitle: "font-semibold",
  ctaText: "mt-1 text-sm text-zinc-600",
  ctaLink: "btnPrimary mt-3 inline-flex",
} as const;

const priceText = (listing: Listing): string => {
  if (listing.priceType === "fixed") return `$${listing.priceMin}`;
  if (listing.priceType === "starting_at") return `From $${listing.priceMin}`;
  if (listing.priceType === "range") {
    const max = listing.priceMax ?? listing.priceMin;
    return `$${listing.priceMin}–$${max}`;
  }
  return "";
}

const ListingNotFound = () =>
(
  <div className={classes.notFoundWrap}>
    <h1 className={classes.h1}>Listing not found</h1>
    <Link to="/market" className={classes.backBtn}>
      Back to market
    </Link>
  </div>
);


const findListing = (id: string | undefined): Listing | undefined => {
  if (!id) return undefined;
  return listings.find((l) => l.id === id);
}

const findCreator = (handle: string): Creator | undefined => (
  creators.find((c) => c.handle === handle)
)

const ListingPage = () => {
  const { id } = useParams<{ id: string }>();

  const listing = findListing(id);
  if (!listing) return <ListingNotFound />;

  const creator = findCreator(listing.creatorHandle);

  return (
    <div className={classes.page}>
      <Link to="/market" className={classes.backLink}>
        ← Back
      </Link>

      <div className={classes.grid}>
        <img src={listing.preview} alt="" className={classes.img} />

        <div className={classes.rightCol}>
          <div className={classes.titleRow}>
            <h1 className={classes.h1}>{listing.title}</h1>
            <span className={classes.badge}>{listing.offeringType}</span>
          </div>

          <p className={classes.desc}>{listing.short}</p>

          <div className={classes.priceRow}>
            <div className={classes.price}>{priceText(listing)}</div>

            {creator && (
              <Link to={`/creator/${creator.handle}`} className={classes.creatorLink}>
                by {creator.displayName} →
              </Link>
            )}
          </div>

          <div className={classes.chips}>
            <span className={classes.chip}>{listing.category}</span>

            {!!listing.videoSubtype && (
              <span className={classes.chip}>{listing.videoSubtype}</span>
            )}

            {listing.deliverables.map((d) => (
              <span key={d} className={classes.chip}>
                {d}
              </span>
            ))}
          </div>

          <div className={classes.ctaBox}>
            <div className={classes.ctaTitle}>Checkout coming soon</div>
            <p className={classes.ctaText}>
              v0 focuses on discovery. Payments + safe delivery will come after.
            </p>

            {creator && (
              <Link to={`/creator/${creator.handle}`} className={classes.ctaLink}>
                Contact creator
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListingPage;