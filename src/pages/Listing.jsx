import { useParams, Link } from "react-router-dom";
import { creators, listings } from "../data/mock";

function priceText(listing) {
    if (listing.priceType === "fixed") return `$${listing.priceMin}`;
    if (listing.priceType === "starting_at") return `From $${listing.priceMin}`;
    if (listing.priceType === "range") return `$${listing.priceMin}–$${listing.priceMax}`;
    return "";
}

const Listing = () => {
    const { id } = useParams();
    const listing = listings.find((l) => l.id === id);

    if (!listing) {
        return (
            <div className="space-y-4">
                <h1 className="text-2xl font-extrabold tracking-tight">Listing not found</h1>
                <Link to="/market" className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold hover:bg-zinc-50">
                    Back to market
                </Link>
            </div>
        );
    }

    const creator = creators.find((c) => c.handle === listing.creatorHandle);

    return (
        <div className="space-y-6">
            <Link to="/market" className="text-sm font-semibold text-zinc-600 hover:text-zinc-900">
                ← Back
            </Link>

            <div className="grid gap-6 lg:grid-cols-2">
                <img src={listing.preview} alt="" className="w-full rounded-3xl border border-zinc-200 object-cover" />

                <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-2xl font-extrabold tracking-tight">{listing.title}</h1>
                        <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-xs font-semibold">
                            {listing.type}
                        </span>
                    </div>

                    <p className="text-zinc-600">{listing.short}</p>

                    <div className="flex items-center justify-between">
                        <div className="text-xl font-extrabold">{priceText(listing)}</div>
                        {creator && (
                            <Link to={`/creator/${creator.handle}`} className="text-sm font-semibold text-zinc-600 hover:text-zinc-900">
                                by {creator.displayName} →
                            </Link>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                            {listing.category}
                        </span>
                        {(listing.tags || []).map((t) => (
                            <span key={t} className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                                {t}
                            </span>
                        ))}
                    </div>

                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                        <div className="font-semibold">Checkout coming soon</div>
                        <p className="mt-1 text-sm text-zinc-600">
                            v0 focuses on discovery. Payments + safe delivery will come after.
                        </p>
                        {creator && (
                            <Link
                                to={`/creator/${creator.handle}`}
                                className="mt-3 inline-flex rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
                            >
                                Contact creator
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Listing