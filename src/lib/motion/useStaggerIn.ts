import { useRef, type RefObject } from "react";
import { gsap, motion, prefersReducedMotion, useGSAP } from "./motion";

type StaggerInOptions = {
  // Changing this (e.g. switching to a different chat) makes the next render animate as a fresh load.
  resetKey?: string | null;
  scrollToEnd?: boolean;
  maxAnimatedItems?: number;
};

export const useStaggerIn = (
  containerRef: RefObject<HTMLElement | null>,
  itemCount: number,
  { resetKey = null, scrollToEnd = false, maxAnimatedItems = 12 }: StaggerInOptions = {}
) => {
  const renderedCountRef = useRef(0);
  const renderedResetKeyRef = useRef(resetKey);

  useGSAP(
    () => {
      if (renderedResetKeyRef.current !== resetKey) {
        renderedResetKeyRef.current = resetKey;
        renderedCountRef.current = 0;
      }

      const container = containerRef.current;
      if (!container) return;

      const previousCount = renderedCountRef.current;
      renderedCountRef.current = itemCount;

      if (scrollToEnd) {
        container.scrollTop = container.scrollHeight;
      }

      const addedCount = itemCount - previousCount;
      if (addedCount <= 0 || prefersReducedMotion()) return;

      const isInitialLoad = previousCount === 0;
      const items = Array.from(container.children)
        .slice(-addedCount)
        .slice(-maxAnimatedItems);

      gsap.from(items, {
        autoAlpha: 0,
        y: motion.distance,
        duration: motion.duration.base,
        stagger: isInitialLoad ? 0.04 : 0.06,
        ease: motion.ease.out,
        clearProps: motion.clearProps,
      });
    },
    { dependencies: [itemCount, resetKey], scope: containerRef }
  );
};
