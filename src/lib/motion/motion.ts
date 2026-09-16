import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export { gsap, useGSAP };

export const motion = {
  duration: { fast: 0.18, base: 0.32, slow: 0.45 },
  ease: { out: "power2.out", inOut: "power2.inOut" },
  distance: 10,
  clearProps: "transform,opacity,visibility",
} as const;

// No matchMedia (e.g. jsdom) is treated as reduced motion so tests render instantly.
export const prefersReducedMotion = (): boolean =>
  typeof window === "undefined" ||
  typeof window.matchMedia !== "function" ||
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
