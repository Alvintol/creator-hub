import { useRef, type ReactNode } from "react";
import { gsap, motion, prefersReducedMotion, useGSAP } from "./motion";

type PageTransitionProps = {
  transitionKey: string;
  children: ReactNode;
  className?: string;
};

const PageTransition = ({ transitionKey, children, className }: PageTransitionProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;

      gsap.fromTo(
        containerRef.current,
        { autoAlpha: 0, y: motion.distance },
        {
          autoAlpha: 1,
          y: 0,
          duration: motion.duration.slow,
          ease: motion.ease.out,
          overwrite: true,
          // A leftover transform would turn this wrapper into the containing block for fixed-position modals.
          clearProps: motion.clearProps,
        }
      );
    },
    { dependencies: [transitionKey], scope: containerRef }
  );

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
};

export default PageTransition;
