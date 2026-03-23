import { CATEGORIES, type CategoryKey, DeliverableKey } from "../domain/catalog";

export const categories = CATEGORIES;

export type PlatformName = "twitch" | "youtube";
export type CommissionStatus = "open" | "limited" | "closed" | (string & {});

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

export type Creator = {
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

export type Listing = {
    id: string;
    creatorHandle: string;
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

export const creators: Creator[] = [
    {
        handle: "pixelpiper",
        displayName: "Pixel Piper",
        verified: true,
        bio: "Emotes + overlays with clean licensing and fast turnaround.",
        tags: ["emotes", "overlays", "cute", "pixel"],
        specialties: ["emotes", "overlays"],
        commissionStatus: "open",
        platforms: {
            twitch: { login: "ArchmageFreya" }
        },
        links: {
            twitch: "https://twitch.tv/ArchmageFreya",
            youtube: "https://youtube.com/@pixelpiper",
        },
        live: { isLive: true, title: "Drawing emotes ✨", platform: "twitch" },
    },
    {
        handle: "rigmancer",
        displayName: "Rigmancer",
        verified: true,
        bio: "PNG-tuber + VTuber model workflow and rigging support.",
        tags: ["pngtuber", "vtuber", "rigging"],
        specialties: ["pngtuber-models", "vtuber-models", "vtuber-rigging"],
        commissionStatus: "limited",
        links: { youtube: "https://youtube.com/@rigmancer" },
        live: { isLive: false, title: "", platform: "youtube" },
    },
    {
        handle: "monzterman",
        displayName: "MonzterMan",
        verified: true,
        bio: "Clips/VOD/Short-form editing + captions + pacing.",
        tags: ["editing", "shorts", "captions"],
        specialties: ["video-editing"],
        commissionStatus: "open",
        platforms: {
            twitch: { login: "monzterman" }
        },
        links: { twitch: "https://twitch.tv/monzterman" },
        live: { isLive: true, title: "Editing shorts", platform: "youtube" },
    },
    {
        handle: "audionerd",
        displayName: "Audio Nerd",
        verified: false,
        bio: "Mic chain, OBS filters, routing, noise, Discord/Twitch setup.",
        tags: ["audio", "obs", "filters", "routing"],
        specialties: ["audio-tech-help"],
        commissionStatus: "open",
        links: { twitch: "https://twitch.tv/audionerd" },
        live: { isLive: false, title: "", platform: "twitch" },
    },
];

export const listings: Listing[] = [
    {
        id: "l1",
        creatorHandle: "pixelpiper",
        offeringType: "digital",
        category: "emotes",
        title: "Cozy Emote Pack (12)",
        priceType: "fixed",
        priceMin: 18,
        priceMax: 18,
        deliverables: ["png"],
        preview: "https://picsum.photos/seed/emotes/960/540",
        short: "12 emotes + variants. Includes PNG + license notes.",
        featured: true,
    },
    {
        id: "l2",
        creatorHandle: "pixelpiper",
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
        id: "l3",
        creatorHandle: "rigmancer",
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
        id: "l4",
        creatorHandle: "cutsceneedits",
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
        id: "l5",
        creatorHandle: "audionerd",
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
        id: "l6",
        creatorHandle: "rigmancer",
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