import { useParams, Link } from "react-router-dom";
import { creators, listings } from "../data/mock";

const CreatorProfile = () => {
    const { handle } = useParams();
    const creator = creators.find((c) => c.handle === handle);
    const creatorListings = listings.filter((l) => l.creatorHandle === handle);

    if (!creator) {
        return (
            <div className="space-y-4">
                <h1 className="text-2xl font-extrabold tracking-tight">Creator not found</h1>
                <Link to="/creators" className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold hover:bg-zinc-50">
                    Back to creators
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <Link to="/creators" className="text-sm font-semibold text-zinc-600 hover:text-zinc-900">
                ← Back
            </Link>

            <section className="rounded-3xl border border-zinc-200 bg-white p-6">
                <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-extrabold tracking-tight">{creator.displayName}</h1>
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

                <p className="mt-2 text-zinc-600">{creator.bio}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                    {creator.links?.twitch && (
                        <a className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800" target="_blank" rel="noreferrer" href={creator.links.twitch}>
                            Twitch
                        </a>
                    )}
                    {creator.links?.youtube && (
                        <a className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold hover:bg-zinc-50" target="_blank" rel="noreferrer" href={creator.links.youtube}>
                            YouTube
                        </a>
                    )}
                    {creator.links?.discord && (
                        <a className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold hover:bg-zinc-50" target="_blank" rel="noreferrer" href={creator.links.discord}>
                            Discord
                        </a>
                    )}
                    {creator.links?.website && (
                        <a className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold hover:bg-zinc-50" target="_blank" rel="noreferrer" href={creator.links.website}>
                            Website
                        </a>
                    )}
                </div>

                {creator.live?.isLive && creator.live?.title && (
                    <p className="mt-4 text-sm text-zinc-600">
                        <span className="font-semibold">Live:</span> {creator.live.title}
                    </p>
                )}
            </section>

            <section className="space-y-3">
                <h2 className="text-xl font-extrabold tracking-tight">Listings</h2>

                {creatorListings.length === 0 ? (
                    <p className="text-sm text-zinc-600">No listings yet.</p>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {creatorListings.map((l) => (
                            <Link
                                key={l.id}
                                to={`/listing/${l.id}`}
                                className="overflow-hidden rounded-2xl border border-zinc-200 bg-white hover:bg-zinc-50"
                            >
                                <img src={l.preview} alt="" className="h-40 w-full object-cover" />
                                <div className="p-4">
                                    <div className="text-base font-extrabold tracking-tight">{l.title}</div>
                                    <p className="mt-1 text-sm text-zinc-600">{l.short}</p>
                                    <div className="mt-3 flex items-center justify-between text-sm">
                                        <span className="font-extrabold">{l.type}</span>
                                        <span className="text-zinc-600">{l.category}</span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}

export default CreatorProfile