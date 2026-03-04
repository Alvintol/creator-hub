import { Link } from "react-router-dom";
import FavoriteButton from "./FavoriteButton";

const CreatorCard = ({ creator }) => {
  return (
    <Link
      to={`/creator/${creator.handle}`}
      className="group relative rounded-2xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50"
    >
      <div className="absolute right-3 top-3">
        <FavoriteButton kind="creator" idOrHandle={creator.handle} />
      </div>

      <div className="flex items-start gap-2">
        <h3 className="text-base font-extrabold tracking-tight">
          {creator.displayName}
        </h3>

        {creator.verified && (
          <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-xs font-semibold">
            Verified
          </span>
        )}

        {creator.live?.isLive && (
          <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
            Live
          </span>
        )}
      </div>

      <p className="mt-2 text-sm text-zinc-600">{creator.bio}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={
            "text-xs font-bold " +
            (creator.commissionStatus === "open"
              ? "text-emerald-600"
              : creator.commissionStatus === "limited"
                ? "text-amber-700"
                : "text-rose-700")
          }
        >
          Commissions: {creator.commissionStatus}
        </span>

        <div className="flex flex-wrap gap-2">
          {(creator.tags || []).slice(0, 4).map((t) => (
            <span
              key={t}
              className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

export default CreatorCard