import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Disclosure } from "../../../lib/motion";

type RequestManageMenuProps = {
  children: ReactNode;
  label?: string;
};

const classes = {
  wrap: "relative",
  trigger: "btnOutline btnSm",
  panel:
    "absolute right-0 top-full z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] space-y-3 rounded-2xl border border-[var(--hairline-strong)] bg-[rgb(var(--surface))] p-4 shadow-[var(--shadow-lg)]",
} as const;

const RequestManageMenu = ({ children, label = "Manage" }: RequestManageMenuProps) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return undefined;

    const handlePointer = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className={classes.wrap}>
      <button
        type="button"
        className={classes.trigger}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        {label}
        <span aria-hidden="true">▾</span>
      </button>

      <Disclosure open={open} id={panelId} className={classes.panel}>
        {children}
      </Disclosure>
    </div>
  );
};

export default RequestManageMenu;
