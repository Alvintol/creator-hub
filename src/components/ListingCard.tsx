import { Link } from "react-router-dom";
import FavouriteButton from "./FavouriteButton";
import type { Listing } from "../data/mock";

const classes = {
  card: "group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white hover:bg-zinc-50",
  favWrap: "absolute right-3 top-3 z-10",

  img: "h-40 w-full object-cover",

  body: "p-4",
  titleRow: "flex flex-wrap items-center gap-2",
  h3: "text-base font-extrabold tracking-tight",

  badge:
    "rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-xs font-semibold",

  desc: "mt-2 text-sm text-zinc-600",

  bottomRow: "mt-3 flex items-center justify-between gap-3",
  price: "text-sm font-extrabold",
  creator: "text-sm text-zinc-600",
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

type ListingCardProps = {
  listing: Listing;
  creatorName: string;
};

const ListingCard = (props: ListingCardProps) => {
  const { listing, creatorName } = props;

  return (
    <Link to={`/listing/${listing.id}`} className={classes.card}>
      <div className={classes.favWrap}>
        <FavouriteButton kind="listing" idOrHandle={listing.id} />
      </div>

      <img src={listing.preview} alt="" className={classes.img} loading="lazy" />

      <div className={classes.body}>
        <div className={classes.titleRow}>
          <h3 className={classes.h3}>{listing.title}</h3>

          <span className={classes.badge}>{listing.offeringType}</span>
        </div>

        <p className={classes.desc}>{listing.short}</p>

        <div className={classes.bottomRow}>
          <span className={classes.price}>{priceText(listing)}</span>
          <span className={classes.creator}>{creatorName}</span>
        </div>
      </div>
    </Link>
  );
};

export default ListingCard;