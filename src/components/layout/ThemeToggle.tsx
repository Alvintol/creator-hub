import { useRef } from "react";
import { gsap, motion, prefersReducedMotion, useGSAP } from "../../lib/motion";
import { useTheme } from "../../providers/ThemeProvider";

const SunIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z" />
  </svg>
);

const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  const iconRef = useRef<HTMLSpanElement>(null);
  const isDark = theme === "dark";

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;

      gsap.fromTo(
        iconRef.current,
        { rotate: -90, scale: 0.6, autoAlpha: 0 },
        {
          rotate: 0,
          scale: 1,
          autoAlpha: 1,
          duration: motion.duration.base,
          ease: "back.out(1.8)",
          clearProps: "transform,opacity,visibility",
        }
      );
    },
    { dependencies: [theme], scope: iconRef, revertOnUpdate: true }
  );

  return (
    <button
      type="button"
      className="themeToggle"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <span ref={iconRef} className="inline-flex">
        {isDark ? <SunIcon /> : <MoonIcon />}
      </span>
    </button>
  );
};

export default ThemeToggle;
