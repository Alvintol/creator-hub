import { useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { creators, listings, categories, type Creator, type Listing } from "../data/mock";
import {
  useHubActions,
  useHubState,
  type HubFilters,
  type OfferingType,
  type VideoSubtype,
  type CategoryKey,
} from "../providers/HubProvider";

const classes = {
  page: "space-y-5",

  headerWrap: "space-y-1",
  h1: "text-2xl font-extrabold tracking-tight",
  subtitle: "text-sm text-zinc-600",

  filtersGrid: "grid gap-3 md:grid-cols-3",
  input: "searchInput md:col-span-1",
  select: "searchInput",

  grid: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",

  card: "card overflow-hidden hover:bg-zinc-50",
  img: "h-40 w-full object-cover",
  body: "p-4",

  topRow: "flex flex-wrap items-center justify-between gap-2",
  title: "text-base font-extrabold tracking-tight",
  badge:
    "rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-xs font-semibold",

  desc: "mt-1 text-sm text-zinc-600",

  bottomRow: "mt-3 flex items-center justify-between text-sm",
  price: "font-extrabold",
  creator: "text-zinc-600",
} as const;

const creatorByHandle = Object.fromEntries(creators.map((c) => [c.handle, c])) as Record<
  string,
  Creator
>;

const priceText = (listing: Listing): string => {
  if (listing.priceType === "fixed") return `$${listing.priceMin}`;
  if (listing.priceType === "starting_at") return `From $${listing.priceMin}`;
  if (listing.priceType === "range") {
    const max = listing.priceMax ?? listing.priceMin;
    return `$${listing.priceMin}–$${max}`;
  }
  return "";
}

const getListingHaystack = (listing: Listing, creator?: Creator): string => {
  return [
    listing.title,
    listing.short,
    listing.category,
    listing.offeringType,
    listing.videoSubtype ?? "",
    ...(listing.deliverables ?? []),
    creator?.displayName ?? "",
    creator?.handle ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

type MarketListingCardProps = {
  listing: Listing;
  creator?: Creator;
};

const MarketListingCard = (props: MarketListingCardProps) => {
  const { listing, creator } = props;

  return (
    <Link to={`/listing/${listing.id}`} className={classes.card}>
      <img src={listing.preview} alt="" className={classes.img} />

      <div className={classes.body}>
        <div className={classes.topRow}>
          <div className={classes.title}>{listing.title}</div>
          {/* FIX: use offeringType */}
          <span className={classes.badge}>{listing.offeringType}</span>
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

const parseFromUrl = (search: string): Partial<HubFilters> => {
  const p = new URLSearchParams(search);

  const q = p.get("q") ?? "";
  const cat = p.get("cat") ?? "all";
  const type = p.get("type") ?? "all";
  const video = p.get("video") ?? "all";

  const patch: Partial<HubFilters> = {};

  patch.q = q;

  patch.category = cat as CategoryKey;
  patch.type = type as OfferingType;
  patch.videoSubtype = video as VideoSubtype;

  return patch;
}

const Market = () => {
  const { filters } = useHubState();
  const { setFilters } = useHubActions();
  const { search } = useLocation();

  useEffect(() => {
    const fromUrl = parseFromUrl(search);

    const patch: Partial<HubFilters> = {};

    if (fromUrl.q !== undefined && fromUrl.q !== filters.q) patch.q = fromUrl.q;
    if (fromUrl.type !== undefined && fromUrl.type !== filters.type) patch.type = fromUrl.type;
    if (fromUrl.category !== undefined && fromUrl.category !== filters.category)
      patch.category = fromUrl.category;
    if (
      fromUrl.videoSubtype !== undefined &&
      fromUrl.videoSubtype !== filters.videoSubtype
    )
      patch.videoSubtype = fromUrl.videoSubtype;

    if (Object.keys(patch).length) setFilters(patch);
  }, [search, filters.q, filters.type, filters.category, filters.videoSubtype, setFilters]);

  const filtered = useMemo((): Listing[] => {
    const s = filters.q.trim().toLowerCase();

    return listings.filter((l) => {
      if (filters.type !== "all" && l.offeringType !== filters.type) return false;

      if (filters.category !== "all" && l.category !== filters.category) return false;

      if (filters.videoSubtype !== "all") {
        if (l.category !== "video-editing") return false;
        if ((l.videoSubtype ?? "all") !== filters.videoSubtype) return false;
      }

      if (!s) return true;

      const c = creatorByHandle[l.creatorHandle];
      return getListingHaystack(l, c).includes(s);
    });
  }, [filters]);

  return (
    <div className={classes.page}>
      <div className={classes.headerWrap}>
        <h1 className={classes.h1}>Market</h1>
        <p className={classes.subtitle}>Digital packs + commission offerings.</p>
      </div>

      <div className={classes.filtersGrid}>
        <input
          className={classes.input}
          value={filters.q}
          onChange={(e) => setFilters({ q: e.currentTarget.value })}
          placeholder="Search listings..."
        />

        <select
          className={classes.select}
          value={filters.type}
          onChange={(e) => setFilters({ type: e.currentTarget.value as OfferingType })}
        >
          <option value="all">All types</option>
          <option value="digital">Digital</option>
          <option value="commission">Commission</option>
          <option value="service">Service</option>
        </select>

        <select
          className={classes.select}
          value={filters.category}
          onChange={(e) => setFilters({ category: e.currentTarget.value as CategoryKey })}
        >
          <option value="all">All categories</option>
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