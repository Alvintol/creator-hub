import { useRef, type ReactNode } from "react";
import { gsap, motion, prefersReducedMotion, useGSAP } from "./motion";

type FadeInProps = {
  children: ReactNode;
  className?: string;
};

const FadeIn = ({ children, className }: FadeInProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;

      gsap.from(containerRef.current, {
        autoAlpha: 0,
        y: motion.distance / 2,
        duration: motion.duration.base,
        ease: motion.ease.out,
        clearProps: motion.clearProps,
      });
    },
    { scope: containerRef }
  );

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
};

export default FadeIn;
