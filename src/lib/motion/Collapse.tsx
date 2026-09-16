import { useRef, useState, type ReactNode } from "react";
import { gsap, motion, prefersReducedMotion, useGSAP } from "./motion";

type CollapseProps = {
  open: boolean;
  children: ReactNode;
  className?: string;
};

const Collapse = ({ open, children, className }: CollapseProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasRenderedRef = useRef(false);
  const [isMounted, setIsMounted] = useState(open);

  if (open && !isMounted) {
    setIsMounted(true);
  }

  useGSAP(
    () => {
      const isFirstRun = !hasRenderedRef.current;
      hasRenderedRef.current = true;

      const element = containerRef.current;
      if (!element) return;

      if (prefersReducedMotion()) {
        if (!open) setIsMounted(false);
        return;
      }

      if (open) {
        if (isFirstRun) return;

        gsap.fromTo(
          element,
          { height: 0, autoAlpha: 0, overflow: "hidden" },
          {
            height: "auto",
            autoAlpha: 1,
            duration: motion.duration.base,
            ease: motion.ease.out,
            overwrite: true,
            clearProps: "height,opacity,visibility,overflow",
          }
        );
        return;
      }

      gsap.to(element, {
        height: 0,
        autoAlpha: 0,
        overflow: "hidden",
        duration: motion.duration.fast,
        ease: motion.ease.inOut,
        overwrite: true,
        onComplete: () => setIsMounted(false),
      });
    },
    { dependencies: [open], scope: containerRef }
  );

  if (!isMounted) return null;

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
};

export default Collapse;
