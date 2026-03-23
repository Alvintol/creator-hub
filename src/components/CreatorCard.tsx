import { Link } from "react-router-dom";
import FavouriteButton from "./FavouriteButton";
import type { Creator } from "../data/mock";
import { useHubState } from "../providers/HubProvider";
import { normalizeTwitchLogin } from "../domain/twitch";

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

const getCommissionStatusClass = (status: Creator["commissionStatus"]): string => {
  if (status === "open") return "text-emerald-600";
  if (status === "limited") return "text-amber-700";
  return "text-rose-700";
};

type CreatorCardProps = {
  creator: Creator;
};

const CreatorCard = (props: CreatorCardProps) => {
  const { creator } = props;

  const { streams } = useHubState();

  const twitchLoginRaw = creator.platforms?.twitch?.login;
  const twitchLogin = twitchLoginRaw ? normalizeTwitchLogin(twitchLoginRaw) : null;
  const isLive = !!(twitchLogin && streams.twitchByLogin[twitchLogin]);

  const commissionClass = `${classes.statusBase} ${getCommissionStatusClass(
    creator.commissionStatus
  )}`;

  return (
    <Link to={`/creator/${creator.handle}`} className={classes.card}>
      <div className={classes.favWrap}>
        <FavouriteButton kind="creator" idOrHandle={creator.handle} />
      </div>

      <div className={classes.titleRow}>
        <h3 className={classes.h3}>{creator.displayName}</h3>

        {!!creator.verified && (
          <span className={`${classes.badgeBase} ${classes.badgeVerified}`}>Verified</span>
        )}

        {isLive && (
          <span className={`${classes.badgeBase} ${classes.badgeLive}`}>Live</span>
        )}
      </div>

      <p className={classes.bio}>{creator.bio}</p>

      <div className={classes.metaRow}>
        <span className={commissionClass}>Commissions: {creator.commissionStatus}</span>

        <div className={classes.tagsWrap}>
          {(creator.tags ?? []).slice(0, 4).map((t) => (
            <span key={t} className={classes.tag}>
              {t}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
};

export default CreatorCard;