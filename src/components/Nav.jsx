import { Link, NavLink, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { CATEGORIES } from "../domain/catalog";

const navLinkClass = ({ isActive }) =>
    "text-sm font-semibold " + (isActive ? "text-zinc-900" : "text-zinc-600 hover:text-zinc-900");

const Nav = () => {
    const navigate = useNavigate();
    const [q, setQ] = useState("");

    const categoryLinks = useMemo(
        () => CATEGORIES.map((c) => ({ key: c.key, label: c.label })),
        []
    );

    return (
        <header className="topbar">
            {/* top row */}
            <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
                <Link to="/" className="shrink-0 text-lg font-black tracking-tight">
                    <span style={{ color: "rgb(var(--brand))" }}>Creator</span>Hub
                </Link>

                <form
                    className="flex w-full items-center gap-2"
                    onSubmit={(e) => {
                        e.preventDefault();
                        const s = q.trim();
                        navigate(s ? `/market?q=${encodeURIComponent(s)}` : "/market");
                    }}
                >
                    <input
                        className="searchInput"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Search emotes, overlays, VTuber models, editors, riggers…"
                    />
                    <button type="submit" className="btnPrimary hidden sm:inline-flex">
                        Search
                    </button>
                </form>

                <nav className="hidden md:flex items-center gap-4">
                    <NavLink to="/market" className={navLinkClass}>Market</NavLink>
                    <NavLink to="/creators" className={navLinkClass}>Creators</NavLink>
                    <NavLink to="/live" className={navLinkClass}>Live</NavLink>
                </nav>
            </div>

            {/* statement bar */}
            <div className="subbar">
                <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
                    <div className="text-xs font-semibold text-zinc-700">
                        Human-made only • No generative AI listings
                    </div>
                    <Link
                        to="/about"
                        className="text-xs font-semibold"
                        style={{ color: "rgb(var(--accent))" }}
                    >
                        Learn more →
                    </Link>
                </div>
            </div>

            {/* category rail */}
            <div className="bg-white">
                <div className="mx-auto max-w-6xl px-4 py-3">
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        <Link to="/market" className="chip whitespace-nowrap">All</Link>
                        {categoryLinks.map((c) => (
                            <Link
                                key={c.key}
                                to={`/market?cat=${c.key}`}
                                className="chip whitespace-nowrap"
                            >
                                {c.label}
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Nav;