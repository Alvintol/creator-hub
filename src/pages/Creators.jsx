import { useMemo } from "react";
import { creators } from "../data/mock";
import CreatorCard from "../components/CreatorCard";
import { useHubState, useHubActions } from "../providers/HubProvider";

const CreatorsPage = () => {
    const { filters } = useHubState();
    const { setFilters } = useHubActions();

    const filtered = useMemo(() => {
        const s = filters.q.trim().toLowerCase();
        return creators.filter((c) => {
            if (filters.onlyLive && !c.live?.isLive) return false;
            if (filters.onlyOpen && c.commissionStatus !== "open") return false;
            if (!s) return true;

            const hay = [c.displayName, c.handle, c.bio, ...(c.tags || [])]
                .join(" ")
                .toLowerCase();

            return hay.includes(s);
        });
    }, [filters]);

    return (
        <div className="space-y-5">
            <div>
                <h1 className="text-2xl font-extrabold tracking-tight">Creators</h1>
                <p className="mt-1 text-sm text-zinc-600">
                    Find artists, editors, and VTuber asset creators.
                </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
                <input
                    className="md:col-span-2 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm"
                    value={filters.q}
                    onChange={(e) => setFilters({ q: e.target.value })}
                    placeholder="Search creators (emotes, vtuber, editing, style tags...)"
                />

                <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-zinc-700">
                        <input
                            type="checkbox"
                            checked={filters.onlyLive}
                            onChange={(e) => setFilters({ onlyLive: e.target.checked })}
                        />
                        Live
                    </label>

                    <label className="flex items-center gap-2 text-sm text-zinc-700">
                        <input
                            type="checkbox"
                            checked={filters.onlyOpen}
                            onChange={(e) => setFilters({ onlyOpen: e.target.checked })}
                        />
                        Open
                    </label>
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((c) => (
                    <CreatorCard key={c.handle} creator={c} />
                ))}
            </div>
        </div>
    );
}

export default CreatorsPage