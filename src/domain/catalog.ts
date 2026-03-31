export const OFFERING_TYPES = [
    { key: "digital", label: "Digital download" },
    { key: "commission", label: "Commission" },
    { key: "service", label: "Service / Consulting" },
] as const;

export const CATEGORIES = [
    { key: "emotes", label: "Emotes", kind: "art" },
    { key: "overlays", label: "Overlays", kind: "streaming" },
    { key: "pngtuber-models", label: "PNG-tuber Models", kind: "vtuber" },
    { key: "vtuber-models", label: "VTuber Models", kind: "vtuber" },
    { key: "vtuber-rigging", label: "PNG/VTuber Rigging", kind: "vtuber" },
    { key: "video-editing", label: "Video Editing", kind: "editing" },
    { key: "audio-tech-help", label: "Audio Tech Help", kind: "tech" },
] as const;

export const DELIVERABLES = [
    { key: "png", label: "PNG" },
    { key: "psd", label: "PSD (Layered)" },
    { key: "ae", label: "After Effects Project" },
    { key: "obs", label: "OBS Scene/Bundle" },
    { key: "model", label: "Model Files" },
    { key: "video", label: "Video File" },
    { key: "project", label: "Project Files" },
    { key: "call", label: "Live Call" },
    { key: "guide", label: "Written Guide" },
] as const;

export const VIDEO_SUBTYPES = [
    { key: "long-form", label: "Long Form (VOD / YouTube edits)" },
    { key: "short-form", label: "Short Form (Shorts / TikTok / Reels)" },
] as const;

// Derived union types  
export type OfferingTypeKey = (typeof OFFERING_TYPES)[number]["key"]; // digital | commission | service
export type CategoryKey = (typeof CATEGORIES)[number]["key"];
export type CategoryKind = (typeof CATEGORIES)[number]["kind"];
export type DeliverableKey = (typeof DELIVERABLES)[number]["key"];
export type VideoSubtypeKey = (typeof VIDEO_SUBTYPES)[number]["key"];

// Maps/Helpers
export const categoryByKey: Record<CategoryKey, (typeof CATEGORIES)[number]> =
    Object.fromEntries(CATEGORIES.map((c) => [c.key, c])) as Record<
        CategoryKey,
        (typeof CATEGORIES)[number]
    >;

export const deliverableByKey: Record<
    DeliverableKey,
    (typeof DELIVERABLES)[number]
> = Object.fromEntries(DELIVERABLES.map((d) => [d.key, d])) as Record<
    DeliverableKey,
    (typeof DELIVERABLES)[number]
>;

export const offeringByKey: Record<
    OfferingTypeKey,
    (typeof OFFERING_TYPES)[number]
> = Object.fromEntries(OFFERING_TYPES.map((o) => [o.key, o])) as Record<
    OfferingTypeKey,
    (typeof OFFERING_TYPES)[number]
>;

export const videoSubtypeByKey: Record<
    VideoSubtypeKey,
    (typeof VIDEO_SUBTYPES)[number]
> = Object.fromEntries(VIDEO_SUBTYPES.map((v) => [v.key, v])) as Record<
    VideoSubtypeKey,
    (typeof VIDEO_SUBTYPES)[number]
>;