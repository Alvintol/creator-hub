import { CATEGORIES, type CategoryKey, DeliverableKey } from "../domain/catalog";

export const categories = CATEGORIES;

export type PlatformName = "twitch" | "youtube";
export type CommissionStatus = "open" | "limited" | "closed" | (string & {});

// Linked third-party platform data for a creator
// These are external identities, not CreatorHub primary keys
export type CreatorPlatforms = {
    twitch?: {
        login: string;
        userId?: string;
    };
    youtube?: {
        channelId: string;
        handle?: string;
    };
};

// Main creator model used by the app
// id = stable internal app id for DB relationships and favourites
// handle = public-facing route slug for URLs like /creator/:handle
export type Creator = {
    id: string;
    handle: string;
    displayName: string;
    verified: boolean;
    bio: string;
    platforms?: CreatorPlatforms;
    tags?: string[];
    specialties?: CategoryKey[];
    commissionStatus: CommissionStatus;
    links?: {
        twitch?: string;
        youtube?: string;
        discord?: string;
        website?: string;
    };
    live?: {
        isLive: boolean;
        title?: string;
        platform?: PlatformName;
    };
};

export type OfferingType = "digital" | "commission" | "service";
export type PriceType = "fixed" | "starting_at" | "range";
export type VideoSubtype = "long-form" | "short-form";

// Listing model used by the marketplace
// creatorId should point to Creator.id
export type Listing = {
    id: string;
    creatorId: string;
    offeringType: OfferingType;
    category: string;

    title: string;
    short: string;
    preview: string;

    priceType: PriceType;
    priceMin: number;
    priceMax: number | null;

    deliverables: DeliverableKey[];
    featured?: boolean;

    videoSubtype?: VideoSubtype;
};

// Mock creator seed data
export const creators: Creator[] = [
    {
        id: "creator-amatrine",
        handle: "Amatrine",
        displayName: "Amatrine",
        verified: true,
        bio: "I'm a freelance artist from Ottawa, Canada who works on emote and other Twitch asset design, film editing, video game design, painting and probably other things",
        tags: [
            "emotes",
            "overlays",
            "cute",
            "asset design",
            "film editing",
            "video game design",
            "painting",
        ],
        specialties: ["emotes", "overlays"],
        commissionStatus: "open",
        platforms: {
            twitch: {
                login: "Amatrine",
            },
            youtube: {
                channelId: "youtube-amatrine",
                handle: "@Amatrine",
            },
        },
        links: {
            twitch: "https://twitch.tv/Amatrine",
            youtube: "https://youtube.com/@Amatrine",
        },
    },
    {
        id: "creator-rigmancer",
        handle: "rigmancer",
        displayName: "Rigmancer",
        verified: true,
        bio: "PNG-tuber + VTuber model workflow and rigging support.",
        tags: ["pngtuber", "vtuber", "rigging"],
        specialties: ["pngtuber-models", "vtuber-models", "vtuber-rigging"],
        commissionStatus: "limited",
        platforms: {
            youtube: {
                channelId: "youtube-rigmancer",
                handle: "@rigmancer",
            },
        },
        links: {
            youtube: "https://youtube.com/@rigmancer",
        },
    },
    {
        id: "creator-jaquillyn",
        handle: "jaQUILLyn",
        displayName: "jaQUILLyn",
        verified: true,
        bio: "Clips/VOD/Short-form editing + captions + pacing.",
        tags: ["editing", "shorts", "captions"],
        specialties: ["video-editing"],
        commissionStatus: "open",
        platforms: {
            twitch: {
                login: "jaQUILLyn",
            },
        },
        links: {
            twitch: "https://twitch.tv/jaQUILLyn",
        },
    },
    {
        id: "creator-audionerd",
        handle: "audionerd",
        displayName: "Audio Nerd",
        verified: false,
        bio: "Mic chain, OBS filters, routing, noise, Discord/Twitch setup.",
        tags: ["audio", "obs", "filters", "routing"],
        specialties: ["audio-tech-help"],
        commissionStatus: "open",
        links: {
            twitch: "https://twitch.tv/audionerd",
        },
    },
];

// Mock listing seed data
// Each listing now points to a stable creatorId instead of a creator handle
export const listings: Listing[] = [
    {
        id: "listing-emotes-01",
        creatorId: "creator-amatrine",
        offeringType: "digital",
        category: "emotes",
        title: "Cozy Emote Pack (12)",
        priceType: "fixed",
        priceMin: 18,
        priceMax: 18,
        deliverables: ["png"],
        preview: "https://picsum.photos/seed/emotes/960/540",
        short: "12 emotes + variants. Includes PNG + licence notes.",
        featured: true,
    },
    {
        id: "listing-overlays-01",
        creatorId: "creator-amatrine",
        offeringType: "commission",
        category: "overlays",
        title: "Custom Stream Overlay Package",
        priceType: "starting_at",
        priceMin: 180,
        priceMax: null,
        deliverables: ["png", "psd", "obs"],
        preview: "https://picsum.photos/seed/overlay/960/540",
        short: "Panels, starting soon, alerts styling. Handoff-ready.",
        featured: false,
    },
    {
        id: "listing-pngtuber-01",
        creatorId: "creator-rigmancer",
        offeringType: "commission",
        category: "pngtuber-models",
        title: "PNG-tuber Model (Full Set)",
        priceType: "range",
        priceMin: 120,
        priceMax: 420,
        deliverables: ["png", "psd", "model"],
        preview: "https://picsum.photos/seed/pngtuber/960/540",
        short: "Expressions + layers with clean naming and export plan.",
        featured: true,
    },
    {
        id: "listing-shortform-01",
        creatorId: "creator-jaquillyn",
        offeringType: "service",
        category: "video-editing",
        videoSubtype: "short-form",
        title: "Short-form Edit (1–3 videos)",
        priceType: "starting_at",
        priceMin: 90,
        priceMax: null,
        deliverables: ["video", "project"],
        preview: "https://picsum.photos/seed/editing/960/540",
        short: "Captions, pacing, sound design. Ready for TikTok/Reels/Shorts.",
        featured: false,
    },
    {
        id: "listing-audio-01",
        creatorId: "creator-audionerd",
        offeringType: "service",
        category: "audio-tech-help",
        title: "Audio Troubleshooting Call (45 min)",
        priceType: "fixed",
        priceMin: 45,
        priceMax: 45,
        deliverables: ["call", "guide"],
        preview: "https://picsum.photos/seed/audio/960/540",
        short: "Mic chain, OBS filters, routing, noise cleanup — live help.",
        featured: true,
    },
    {
        id: "listing-rigging-01",
        creatorId: "creator-rigmancer",
        offeringType: "service",
        category: "vtuber-rigging",
        title: "PNG/VTuber Rigging Help (Live Session)",
        priceType: "fixed",
        priceMin: 60,
        priceMax: 60,
        deliverables: ["call", "guide"],
        preview: "https://picsum.photos/seed/rigging/960/540",
        short: "Rig troubleshooting, export pipeline, naming, physics basics, handoff checklist.",
        featured: true,
    },
];