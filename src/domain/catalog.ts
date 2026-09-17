export const CATEGORIES = [
    { key: "emotes", label: "Emotes", kind: "art" },
    { key: "overlays", label: "Overlays", kind: "streaming" },
    { key: "pngtuber-models", label: "PNG-tuber Models", kind: "vtuber" },
    { key: "vtuber-models", label: "VTuber Models", kind: "vtuber" },
    { key: "vtuber-rigging", label: "PNG/VTuber Rigging", kind: "vtuber" },
    { key: "video-editing", label: "Video Editing", kind: "editing" },
    { key: "audio-tech-help", label: "Audio Tech Help", kind: "tech" },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]["key"];
