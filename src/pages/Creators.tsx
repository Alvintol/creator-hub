import { useMemo } from "react";
import { creators, type Creator } from "../data/mock";
import CreatorCard from "../components/CreatorCard";
import {
  useHubState,
  useHubActions,
  type HubFilters,
  type HubActions,
} from "../providers/hub";

const classes = {
  container: "space-y-5",

  headerWrap: "space-y-1",
  h1: "text-2xl font-extrabold tracking-tight",
  subtitle: "text-sm text-zinc-600",

  filtersGrid: "grid gap-3 md:grid-cols-3",
  input: "searchInput md:col-span-2",

  togglesRow: "flex items-center gap-4",
  label: "flex items-center gap-2 text-sm text-zinc-700",
  checkbox: "h-4 w-4 accent-[rgb(var(--ink))]",

  cardsGrid: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
} as const;

// Filters creators using the current Hub filter state
const getFilteredCreators = (list: Creator[], filters: HubFilters): Creator[] => {
  const searchValue = filters.q.trim().toLowerCase();

  return list.filter((creator) => {
    if (filters.onlyLive && !creator.live?.isLive) return false;
    if (filters.onlyOpen && creator.commissionStatus !== "open") return false;
    if (!searchValue) return true;

    const haystack = [
      creator.displayName,
      creator.handle,
      creator.bio,
      ...(creator.tags ?? []),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(searchValue);
  });
};

const PageHeader = () => (
  <div className={classes.headerWrap}>
    <h1 className={classes.h1}>Creators</h1>
    <p className={classes.subtitle}>
      Find artists, editors, and VTuber asset creators.
    </p>
  </div>
);

type FiltersRowProps = {
  filters: HubFilters;
  setFilters: HubActions["setFilters"];
};

const FiltersRow = (props: FiltersRowProps) => {
  const { filters, setFilters } = props;

  return (
    <div className={classes.filtersGrid}>
      <input
        className={classes.input}
        value={filters.q}
        onChange={(event) => setFilters({ q: event.currentTarget.value })}
        placeholder="Search creators (emotes, vtuber, editing, style tags...)"
      />

      <div className={classes.togglesRow}>
        <label className={classes.label}>
          <input
            className={classes.checkbox}
            type="checkbox"
            checked={filters.onlyLive}
            onChange={(event) =>
              setFilters({ onlyLive: event.currentTarget.checked })
            }
          />
          Live
        </label>

        <label className={classes.label}>
          <input
            className={classes.checkbox}
            type="checkbox"
            checked={filters.onlyOpen}
            onChange={(event) =>
              setFilters({ onlyOpen: event.currentTarget.checked })
            }
          />
          Open
        </label>
      </div>
    </div>
  );
};

const CreatorsPage = () => {
  const { filters } = useHubState();
  const { setFilters } = useHubActions();

  const filtered = useMemo(
    () => getFilteredCreators(creators, filters),
    [filters]
  );

  return (
    <div className={classes.container}>
      <PageHeader />
      <FiltersRow filters={filters} setFilters={setFilters} />

      <div className={classes.cardsGrid}>
        {filtered.map((creator) => (
          <CreatorCard key={creator.id} creator={creator} />
        ))}
      </div>
    </div>
  );
};

export default CreatorsPage;