import { useRef, useState, type ReactNode } from "react";
import { gsap, motion, prefersReducedMotion, useGSAP } from "./motion";

type DisclosureProps = {
  open: boolean;
  id?: string;
  children: ReactNode;
  className?: string;
};

// Unlike Collapse, content stays mounted while closed so in-progress forms keep their state.
const Disclosure = ({ open, id, children, className }: DisclosureProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  // Compared against the last applied value so StrictMode's repeated mount effect doesn't animate.
  const appliedOpenRef = useRef<boolean | null>(null);
  // hidden is owned by the effect after mount; a changing prop would cut the close animation short.
  const [initiallyHidden] = useState(!open);

  useGSAP(
    () => {
      const panel = panelRef.current;
      if (!panel) return;

      const isChange = appliedOpenRef.current !== null && appliedOpenRef.current !== open;
      appliedOpenRef.current = open;

      if (!isChange || prefersReducedMotion()) {
        panel.hidden = !open;
        return;
      }

      if (open) {
        panel.hidden = false;
        gsap.fromTo(
          panel,
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

      gsap.to(panel, {
        height: 0,
        autoAlpha: 0,
        overflow: "hidden",
        duration: motion.duration.fast,
        ease: motion.ease.inOut,
        overwrite: true,
        onComplete: () => {
          panel.hidden = true;
          gsap.set(panel, { clearProps: "height,opacity,visibility,overflow" });
        },
      });
    },
    { dependencies: [open], scope: panelRef }
  );

  return (
    <div ref={panelRef} id={id} className={className} hidden={initiallyHidden}>
      {children}
    </div>
  );
};

export default Disclosure;
