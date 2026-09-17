import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { RequestWorkspaceSectionId } from "../../../domain/listings/requestWorkspace";
import { Disclosure } from "../../../lib/motion";
import { useWorkspace } from "./WorkspaceContext";

type WorkspaceSectionProps = {
  id: RequestWorkspaceSectionId;
  title: string;
  summary?: ReactNode;
  attention?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
};

const classes = {
  // Clears the sticky site header, plus the mobile tab bar below lg.
  section: "scroll-mt-36 lg:scroll-mt-24",
  toggle:
    "flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-[rgb(var(--ink)/0.03)] focus-visible:bg-[rgb(var(--accent-soft))] focus-visible:outline-none sm:px-5",
  heading: "min-w-0 flex-1",
  title: "block font-display text-sm font-bold tracking-tight text-zinc-900",
  summary: "mt-0.5 block truncate text-xs text-zinc-500",
  aside: "flex shrink-0 items-center gap-2",
  attention:
    "inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800",
  chevron: "h-4 w-4 text-zinc-500 transition-transform duration-200",
  panel: "workspacePanel space-y-4 px-4 pb-5 sm:px-5",
} as const;

const Chevron = ({ open }: { open: boolean }) => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className={`${classes.chevron} ${open ? "rotate-180" : ""}`}
    aria-hidden="true"
  >
    <path d="m5 8 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const WorkspaceSection = ({
  id,
  title,
  summary,
  attention = false,
  defaultOpen = false,
  children,
}: WorkspaceSectionProps) => {
  const panelId = useId();
  const sectionRef = useRef<HTMLElement>(null);
  const { focusRequest } = useWorkspace();
  // null follows defaultOpen (which can flip once data loads); a click pins the viewer's choice.
  const [openOverride, setOpenOverride] = useState<boolean | null>(null);
  const isOpen = openOverride ?? (defaultOpen || attention);

  useEffect(() => {
    if (focusRequest?.id !== id) return;

    setOpenOverride(true);
    window.requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    });
  }, [focusRequest, id]);

  return (
    <section ref={sectionRef} id={`request-section-${id}`} className={classes.section}>
      <h2>
        <button
          type="button"
          className={classes.toggle}
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => setOpenOverride(!isOpen)}
        >
          <span className={classes.heading}>
            <span className={classes.title}>{title}</span>
            {summary && <span className={classes.summary}>{summary}</span>}
          </span>

          <span className={classes.aside}>
            {attention && <span className={classes.attention}>Needs attention</span>}
            <Chevron open={isOpen} />
          </span>
        </button>
      </h2>

      <Disclosure open={isOpen} id={panelId} className={classes.panel}>
        {children}
      </Disclosure>
    </section>
  );
};

export default WorkspaceSection;
