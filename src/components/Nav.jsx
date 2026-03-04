import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { CATEGORIES } from '../domain/catalog';

const classes = {
  header: 'topbar',

  topRow: 'mx-auto flex max-w-6xl items-center gap-3 px-4 py-3',
  brandLink: 'shrink-0 text-lg font-black tracking-tight',
  brandAccent: 'text-[rgb(var(--brand))]',

  form: 'flex w-full items-center gap-2',
  searchInput: 'searchInput',
  searchButton: 'btnPrimary hidden sm:inline-flex',

  nav: 'hidden md:flex items-center gap-4',
  navLinkBase: 'text-sm font-semibold',
  navLinkActive: 'text-zinc-900',
  navLinkInactive: 'text-zinc-600 hover:text-zinc-900',

  subbar: 'subbar',
  subbarRow:
    'mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2',
  statement: 'text-xs font-semibold text-zinc-700',
  aboutLink: 'text-xs font-semibold text-[rgb(var(--accent))]',

  categoryWrap: 'bg-white',
  categoryInner: 'mx-auto max-w-6xl px-4 py-3',
  categoryRow: 'flex gap-2 overflow-x-auto pb-1',
  chip: 'chip whitespace-nowrap',
};

const navLinkClass = ({ isActive }) => {
  return `${classes.navLinkBase} ${
    isActive ? classes.navLinkActive : classes.navLinkInactive
  }`;
};

const getMarketUrl = (q) => {
  const s = q.trim();
  return s ? `/market?q=${encodeURIComponent(s)}` : '/market';
};

const Nav = () => {
  const navigate = useNavigate();
  const [q, setQ] = useState('');

  const categoryLinks = useMemo(() => {
    return CATEGORIES.map((c) => ({ key: c.key, label: c.label }));
  }, []);

  const onSubmit = (e) => {
    e.preventDefault();
    navigate(getMarketUrl(q));
  };

  return (
    <header className={classes.header}>
      {/* top row */}
      <div className={classes.topRow}>
        <Link to='/' className={classes.brandLink}>
          <span className={classes.brandAccent}>Creator</span>Hub
        </Link>

        <form className={classes.form} onSubmit={onSubmit}>
          <input
            className={classes.searchInput}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder='Search emotes, overlays, VTuber models, editors, riggers…'
          />
          <button type='submit' className={classes.searchButton}>
            Search
          </button>
        </form>

        <nav className={classes.nav}>
          <NavLink to='/market' className={navLinkClass}>
            Market
          </NavLink>
          <NavLink to='/creators' className={navLinkClass}>
            Creators
          </NavLink>
          <NavLink to='/live' className={navLinkClass}>
            Live
          </NavLink>
        </nav>
      </div>

      {/* statement bar */}
      <div className={classes.subbar}>
        <div className={classes.subbarRow}>
          <div className={classes.statement}>
            Human-made only • No generative AI listings
          </div>
          <Link to='/about' className={classes.aboutLink}>
            Learn more →
          </Link>
        </div>
      </div>

      {/* category rail */}
      <div className={classes.categoryWrap}>
        <div className={classes.categoryInner}>
          <div className={classes.categoryRow}>
            <Link to='/market' className={classes.chip}>
              All
            </Link>

            {categoryLinks.map((c) => (
              <Link
                key={c.key}
                to={`/market?cat=${c.key}`}
                className={classes.chip}
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
