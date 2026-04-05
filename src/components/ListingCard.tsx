import FavouriteButton from "./FavouriteButton";
import { Link } from "react-router-dom";

const classes = {
  card: "group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white hover:bg-zinc-50",
  favWrap: "absolute right-3 top-3 z-10",

  img: "h-40 w-full object-cover bg-zinc-100",

  body: "p-4",
  titleRow: "flex flex-wrap items-center gap-2",
  h3: "text-base font-extrabold tracking-tight",

  badge:
    "rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-xs font-semibold",
  liveBadge: "badge badgeLive",

  desc: "mt-2 text-sm text-zinc-600",

  bottomRow: "mt-3 flex items-center justify-between gap-3",
  price: "text-sm font-extrabold",
  creator: "text-sm text-zinc-600",
} as const;

export type ListingCardListing = {
  id: string;
  title: string;
  short: string;
  offering_type: string;
  price_type: "fixed" | "starting_at" | "range";
  price_min: number;
  price_max: number | null;
  preview_url: string | null;
};

export type ListingCardCreator = {
  name: string;
  isLive?: boolean;
};

type ListingCardProps = {
  listing: ListingCardListing;
  creator: ListingCardCreator;
};

const priceText = (listing: ListingCardListing): string =>
  listing.price_type === "fixed"
    ? `$${listing.price_min}`
    : listing.price_type === "starting_at"
      ? `From $${listing.price_min}`
      : listing.price_type === "range"
        ? `$${listing.price_min}–$${listing.price_max ?? listing.price_min}`
        : "";

const ListingCard = ({ listing, creator }: ListingCardProps) => {
  const creatorLabel = creator.isLive ? `${creator.name} • Live` : creator.name;

  return (
    <Link to={`/listing/${listing.id}`} className={classes.card}>
      <div className={classes.favWrap}>
        <FavouriteButton kind="listing" targetId={listing.id} />
      </div>

      <img
        src={listing.preview_url ?? ""}
        alt=""
        className={classes.img}
        loading="lazy"
      />

      <div className={classes.body}>
        <div className={classes.titleRow}>
          <h3 className={classes.h3}>{listing.title}</h3>

          <span className={classes.badge}>{listing.offering_type}</span>

          {creator.isLive && <span className={classes.liveBadge}>Live</span>}
        </div>

        <p className={classes.desc}>{listing.short}</p>

        <div className={classes.bottomRow}>
          <span className={classes.price}>{priceText(listing)}</span>
          <span className={classes.creator}>{creatorLabel}</span>
        </div>
      </div>
    </Link>
  );
};

export default ListingCard;