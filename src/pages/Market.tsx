import { useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import ListingCard from "../components/ListingCard";
import { normalizeTwitchLogin } from "../domain/twitch";
import { useTwitchStreams } from "../hooks/useTwitchStreams";
import { useMarketListings, type MarketListingItem } from "../hooks/useMarketListings";
import {
  useHubActions,
  useHubState,
  type HubFilters,
  type OfferingType,
  type VideoSubtype,
  type CategoryKey,
} from "../providers/hub";

const classes = {
  page: "space-y-5",

  headerWrap: "space-y-1",
  h1: "text-2xl font-extrabold tracking-tight",
  subtitle: "text-sm text-zinc-600",

  filtersGrid: "grid gap-3 md:grid-cols-3",
  input: "searchInput md:col-span-1",
  select: "searchInput",

  grid: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
  loadingText: "text-sm text-zinc-600",
  emptyText: "text-sm text-zinc-600",
} as const;

// Temporary category list until categories move to db/config
const categoryOptions = [
  { key: "all", label: "All categories" },
  { key: "emotes", label: "Emotes" },
  { key: "overlays", label: "Overlays" },
  { key: "pngtuber-models", label: "PNG-tuber models" },
  { key: "vtuber-models", label: "VTuber models" },
  { key: "vtuber-rigging", label: "VTuber rigging" },
  { key: "video-editing", label: "Video editing" },
  { key: "audio-tech-help", label: "Audio tech help" },
] as const;

// Builds a search string for listing filtering
const getListingHaystack = (item: MarketListingItem): string => {
  const { listing, creator, platformAccounts } = item;

  const twitchAccount =
    platformAccounts.find((account) => account.platform === "twitch") ?? null;

  return [
    listing.title,
    listing.short,
    listing.category,
    listing.offering_type,
    listing.video_subtype ?? "",
    ...(listing.deliverables ?? []),
    ...(listing.tags ?? []),
    creator?.display_name ?? "",
    creator?.handle ?? "",
    twitchAccount?.platform_login ?? "",
    twitchAccount?.platform_display_name ?? "",
  ]
    .join(" ")
    .toLowerCase();
};

// Reads supported filter values from the current URL query string
const parseFromUrl = (search: string): Partial<HubFilters> => {
  const params = new URLSearchParams(search);

  const q = params.get("q") ?? "";
  const category = params.get("cat") ?? "all";
  const type = params.get("type") ?? "all";
  const videoSubtype = params.get("video") ?? "all";

  return {
    q,
    category: category as CategoryKey,
    type: type as OfferingType,
    videoSubtype: videoSubtype as VideoSubtype,
  };
};

const Market = () => {
  const { filters } = useHubState();
  const { setFilters } = useHubActions();
  const { search } = useLocation();
  const { twitchByLogin } = useTwitchStreams();

  const { data: items = [], isLoading, error } = useMarketListings();

  // Syncs supported URL params into Hub filter state
  useEffect(() => {
    const fromUrl = parseFromUrl(search);
    const patch: Partial<HubFilters> = {};

    if (fromUrl.q !== undefined && fromUrl.q !== filters.q) {
      patch.q = fromUrl.q;
    }

    if (fromUrl.type !== undefined && fromUrl.type !== filters.type) {
      patch.type = fromUrl.type;
    }

    if (
      fromUrl.category !== undefined &&
      fromUrl.category !== filters.category
    ) {
      patch.category = fromUrl.category;
    }

    if (
      fromUrl.videoSubtype !== undefined &&
      fromUrl.videoSubtype !== filters.videoSubtype
    ) {
      patch.videoSubtype = fromUrl.videoSubtype;
    }

    if (Object.keys(patch).length > 0) {
      setFilters(patch);
    }
  }, [
    search,
    filters.q,
    filters.type,
    filters.category,
    filters.videoSubtype,
    setFilters,
  ]);

  // Applies the current Hub filters to public marketplace listings
  const filtered = useMemo((): MarketListingItem[] => {
    const searchValue = filters.q.trim().toLowerCase();

    return items.filter((item) => {
      const { listing } = item;

      if (
        filters.type !== "all" &&
        listing.offering_type !== filters.type
      ) {
        return false;
      }

      if (
        filters.category !== "all" &&
        listing.category !== filters.category
      ) {
        return false;
      }

      if (filters.videoSubtype !== "all") {
        if (listing.category !== "video-editing") return false;
        if ((listing.video_subtype ?? "all") !== filters.videoSubtype) {
          return false;
        }
      }

      if (!searchValue) return true;

      return getListingHaystack(item).includes(searchValue);
    });
  }, [filters, items]);

  return (
    <div className={classes.page}>
      <div className={classes.headerWrap}>
        <h1 className={classes.h1}>Market</h1>
        <p className={classes.subtitle}>Digital packs + commission offerings.</p>
      </div>

      <div className={classes.filtersGrid}>
        <input
          className={classes.input}
          value={filters.q}
          onChange={(event) => setFilters({ q: event.currentTarget.value })}
          placeholder="Search listings..."
        />

        <select
          className={classes.select}
          value={filters.type}
          onChange={(event) =>
            setFilters({ type: event.currentTarget.value as OfferingType })
          }
        >
          <option value="all">All types</option>
          <option value="digital">Digital</option>
          <option value="commission">Commission</option>
          <option value="service">Service</option>
        </select>

        <select
          className={classes.select}
          value={filters.category}
          onChange={(event) =>
            setFilters({ category: event.currentTarget.value as CategoryKey })
          }
        >
          {categoryOptions.map((category) => (
            <option key={category.key} value={category.key}>
              {category.label}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <div className={classes.loadingText}>Loading…</div>}

      {error && !isLoading && (
        <div className={classes.loadingText}>
          Could not load marketplace listings.
        </div>
      )}

      {!isLoading && !error && filtered.length === 0 && (
        <div className={classes.emptyText}>No listings found.</div>
      )}

      <div className={classes.grid}>
        {filtered.map((item) => {
          const { listing, creator, platformAccounts } = item;

          const twitchAccount =
            platformAccounts.find((account) => account.platform === "twitch") ?? null;

          const twitchLoginRaw = twitchAccount?.platform_login ?? null;
          const twitchLogin = twitchLoginRaw
            ? normalizeTwitchLogin(twitchLoginRaw)
            : null;

          const isLive = twitchLogin ? Boolean(twitchByLogin[twitchLogin]) : false;

          return (
            <ListingCard
              key={listing.id}
              listing={{
                id: listing.id,
                title: listing.title,
                short: listing.short,
                offering_type: listing.offering_type,
                price_type: listing.price_type,
                price_min: listing.price_min,
                price_max: listing.price_max,
                preview_url: listing.preview_url,
              }}
              creator={{
                name: creator?.display_name ?? creator?.handle ?? "Unknown creator",
                isLive,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

export default Market;