import { Link } from "react-router-dom";
import FavouriteButton from "./FavouriteButton";

const classes = {
  card: "group relative rounded-2xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50",
  favWrap: "absolute right-3 top-3",

  titleRow: "flex items-start gap-2",
  h3: "text-base font-extrabold tracking-tight",

  badgeBase: "rounded-full border bg-white px-2 py-0.5 text-xs font-semibold",
  badgeVerified: "border-zinc-200",
  badgeLive: "border-rose-200 bg-rose-50 text-rose-700",

  bio: "mt-2 text-sm text-zinc-600",

  metaRow: "mt-3 flex flex-wrap items-center gap-2",
  statusBase: "text-xs font-bold",

  tagsWrap: "flex flex-wrap gap-2",
  tag: "rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700",
} as const;

export type CreatorCardModel = {
  id: string;
  handle: string;
  displayName: string;
  verified: boolean;
  bio: string;
  tags?: string[];
  specialties?: string[];
  commissionStatus: string;
  platforms?: {
    twitch?: {
      login: string;
      userId?: string;
    };
    youtube?: {
      channelId: string;
      handle?: string;
    };
  };
  links?: {
    twitch?: string;
    youtube?: string;
  };
  live?: {
    isLive: boolean;
    title?: string;
    platform?: "twitch" | "youtube";
  };
};

// Maps commission status to its matching text colour
const getCommissionStatusClass = (status: CreatorCardModel["commissionStatus"]): string =>
  status === "open"
    ? "text-emerald-600"
    : status === "limited"
      ? "text-amber-700"
      : "text-rose-700";

type CreatorCardProps = {
  creator: CreatorCardModel;
};

const CreatorCard = ({ creator }: CreatorCardProps) => {
  const isLive = Boolean(creator.live?.isLive);

  const commissionClass = `${classes.statusBase} ${getCommissionStatusClass(
    creator.commissionStatus
  )}`;

  return (
    <Link to={`/creator/${creator.handle}`} className={classes.card}>
      <div className={classes.favWrap}>
        {/* Favourites must use the stable internal creator id, not the handle */}
        <FavouriteButton kind="creator" targetId={creator.id} />
      </div>

      <div className={classes.titleRow}>
        <h3 className={classes.h3}>{creator.displayName}</h3>

        {creator.verified && (
          <span className={`${classes.badgeBase} ${classes.badgeVerified}`}>
            Verified
          </span>
        )}

        {isLive && (
          <span className={`${classes.badgeBase} ${classes.badgeLive}`}>
            Live
          </span>
        )}
      </div>

      <p className={classes.bio}>{creator.bio}</p>

      <div className={classes.metaRow}>
        <span className={commissionClass}>
          Commissions: {creator.commissionStatus}
        </span>

        <div className={classes.tagsWrap}>
          {(creator.tags ?? []).slice(0, 4).map((tag) => (
            <span key={tag} className={classes.tag}>
              {tag}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
};

export default CreatorCard;