import type { MouseEventHandler } from "react";
import {
  useHubActions,
  useHubState,
  type FavouritesState,
} from "../providers/hub";

type FavouriteKind = "creator" | "listing";

type HeartProps = {
  filled: boolean;
};

type FavouriteButtonProps = {
  kind: FavouriteKind;

  // Stable internal app id for the thing being favourited
  // creator -> creator.id
  // listing -> listing.id
  targetId: string;

  className?: string;
};

const classes = {
  heart: "h-5 w-5",

  btnBase:
    "inline-flex items-center justify-center rounded-xl border px-2 py-2",
  btnOn: "border-rose-200 bg-rose-50 text-rose-600",
  btnOff: "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
} as const;

// Small heart icon used by the favourite button
const Heart = (props: HeartProps) => (
  <svg viewBox="0 0 24 24" className={classes.heart} aria-hidden="true">
    <path
      d="M12 21s-7.2-4.7-9.6-9.2C.7 8.4 2.4 5.6 5.5 5.1c1.7-.3 3.3.4 4.4 1.6 1.1-1.2 2.7-1.9 4.4-1.6 3.1.5 4.8 3.3 3.1 6.7C19.2 16.3 12 21 12 21z"
      fill={props.filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.6"
    />
  </svg>
);

// Checks whether the current target is already favourited
const getIsFavourite = (
  kind: FavouriteKind,
  targetId: string,
  favourites: FavouritesState
): boolean =>
  kind === "creator" ? Boolean(favourites.creators[targetId]) : Boolean(favourites.listings[targetId]);

// Builds the final button class string based on the favourite state
const getButtonClassName = (isFavourite: boolean, className: string): string => {
  const variant = isFavourite ? classes.btnOn : classes.btnOff;
  return `${classes.btnBase} ${variant} ${className}`.trim();
};

const FavouriteButton = (props: FavouriteButtonProps) => {
  const { kind, targetId, className = "" } = props;

  const { favourites } = useHubState();
  const { toggleFavouriteCreator, toggleFavouriteListing } = useHubActions();

  const isFavourite = getIsFavourite(kind, targetId, favourites);

  // Prevent the button click from triggering the parent card link
  const onClick: MouseEventHandler<HTMLButtonElement> = (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (kind === "creator") {
      void toggleFavouriteCreator(targetId);
      return;
    }

    void toggleFavouriteListing(targetId);
  };

  return (
    <button
      onClick={onClick}
      className={getButtonClassName(isFavourite, className)}
      aria-label={isFavourite ? "Remove favourite" : "Add favourite"}
      aria-pressed={isFavourite}
      title={isFavourite ? "Favourited" : "Favourite"}
      type="button"
    >
      <Heart filled={isFavourite} />
    </button>
  );
};

export default FavouriteButton;