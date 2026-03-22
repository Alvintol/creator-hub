import {
  Link,
  NavLink,
  useNavigate,
  useLocation,
  type NavLinkProps,
} from "react-router-dom";
import { useMemo, useState } from "react";
import { CATEGORIES } from "../domain/catalog";

type CategoryLink = { key: string; label: string };

const classes = {
  header: "topbar",

  topRow: "mx-auto flex max-w-6xl items-center gap-3 px-4 py-3",
  brandLink: "shrink-0 text-lg font-black tracking-tight",
  brandAccent: "text-[rgb(var(--brand))]",

  form: "flex w-full items-center gap-2",
  searchInput: "searchInput",
  searchButton: "btnPrimary hidden sm:inline-flex",

  nav: "hidden md:flex items-center gap-4",
  navLinkBase: "text-sm font-semibold",
  navLinkActive: "text-zinc-900",
  navLinkInactive: "text-zinc-700 hover:text-zinc-900",

  subbar: "subbar",
  subbarRow:
    "mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2",
  statement: "text-xs font-semibold text-zinc-800",
  aboutLink: "linkPill",

  categoryWrap: "categoryBar",
  categoryInner: "categoryBarInner",
  categoryRow: "categoryRow",
  categoryTitle: "categoryTitle",

  chip: "navChip whitespace-nowrap",
  chipActive: "navChip navChipActive whitespace-nowrap",
} as const;

const navLinkClass: NavLinkProps["className"] = ({ isActive }) =>
  `${classes.navLinkBase} ${
    isActive ? classes.navLinkActive : classes.navLinkInactive
  }`;

const getMarketUrl = (q: string) => {
  const s = q.trim();
  return s ? `/market?q=${encodeURIComponent(s)}` : "/market";
};

const Nav = () => {
  const navigate = useNavigate();
  const { search } = useLocation();
  const [q, setQ] = useState("");

  const activeCat = useMemo(() => {
    const p = new URLSearchParams(search);
    return p.get("cat") ?? "";
  }, [search]);

  const categoryLinks = useMemo<CategoryLink[]>(
    () => CATEGORIES.map((c: any) => ({ key: String(c.key), label: String(c.label) })),
    []
  );

  const onSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    navigate(getMarketUrl(q));
  };

  const chipClass = (key: string | null) => {
    const isAll = key === null;
    const isActive = isAll ? !activeCat : activeCat === key;
    return isActive ? classes.chipActive : classes.chip;
  };

  return (
    <header className={classes.header}>
      <div className={classes.topRow}>
        <Link to="/" className={classes.brandLink}>
          <span className={classes.brandAccent}>Creator</span>Hub
        </Link>

        <form className={classes.form} onSubmit={onSubmit}>
          <input
            className={classes.searchInput}
            aria-label="Search marketplace"
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
            placeholder="Search emotes, overlays, VTuber models, editors, riggers…"
          />
          <button type="submit" className={classes.searchButton}>
            Search
          </button>
        </form>

        <nav className={classes.nav}>
          <NavLink to="/market" className={navLinkClass}>Market</NavLink>
          <NavLink to="/creators" className={navLinkClass}>Creators</NavLink>
          <NavLink to="/live" className={navLinkClass}>Live</NavLink>
        </nav>
      </div>

      <div className={classes.subbar}>
        <div className={classes.subbarRow}>
          <div className={classes.statement}>
            Human-made only • No generative AI listings
          </div>
          <Link to="/about" className={classes.aboutLink}>
            Learn more →
          </Link>
        </div>
      </div>

      <div className={classes.categoryWrap}>
        <div className={classes.categoryInner}>
          <div className={classes.categoryRow}>
            <span className={classes.categoryTitle}>Browse categories</span>

            <Link to="/market" className={chipClass(null)}>All</Link>

            {categoryLinks.map((c) => (
              <Link
                key={c.key}
                to={`/market?cat=${encodeURIComponent(c.key)}`}
                className={chipClass(c.key)}
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