export const creators = [
    {
        handle: "pixelpiper",
        displayName: "Pixel Piper",
        verified: true,
        bio: "Emotes + overlays in a cute pixel style. Fast turnaround, clear licensing.",
        tags: ["emotes", "overlays", "pixel", "cute"],
        commissionStatus: "open", // open | limited | closed
        links: {
            twitch: "https://twitch.tv/pixelpiper",
            youtube: "https://youtube.com/@pixelpiper",
        },
        live: { isLive: true, title: "Drawing new emote set ✨", platform: "twitch" },
    },
    {
        handle: "vtmason",
        displayName: "VT Mason",
        verified: false,
        bio: "VTuber assets + model prep (PNGs, props, rig-ready deliverables).",
        tags: ["vtuber", "png", "props"],
        commissionStatus: "limited",
        links: { twitch: "https://twitch.tv/vtmason" },
        live: { isLive: false, title: "", platform: "twitch" },
    },
];

export const listings = [
    {
        id: "l1",
        creatorHandle: "pixelpiper",
        type: "digital", // digital | commission
        category: "emotes",
        title: "Cozy Pixel Emote Pack (12)",
        priceType: "fixed",
        priceMin: 18,
        priceMax: 18,
        tags: ["pixel", "cute", "twitch"],
        preview: "https://picsum.photos/seed/emotes/640/360",
        short: "12 emotes + variants. Includes PNG + usage notes.",
    },
    {
        id: "l2",
        creatorHandle: "pixelpiper",
        type: "commission",
        category: "emotes",
        title: "Custom Emotes (1–6)",
        priceType: "range",
        priceMin: 25,
        priceMax: 140,
        tags: ["custom", "twitch"],
        preview: "https://picsum.photos/seed/emotecom/640/360",
        short: "Custom emotes with clear license + turnaround.",
    },
];

export const categories = [
    { key: "emotes", label: "Emotes" },
    { key: "png", label: "PNGs" },
    { key: "vtuber-assets", label: "VTuber Assets" },
    { key: "video-editing", label: "Video Editing" },
];