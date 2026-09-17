import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { RequestStage } from "../../../domain/listings/requestWorkspace";

type StatusTone = "review" | "success" | "danger" | "muted";

type RequestWorkspaceHeaderProps = {
  backTo: string;
  backLabel: string;
  eyebrow: string;
  title: string;
  meta: ReactNode[];
  statusLabel: string;
  statusTone: StatusTone;
  stages: RequestStage[];
  actions?: ReactNode;
  notice?: ReactNode;
};

const statusToneClass: Record<StatusTone, string> = {
  review: "border-amber-200 bg-amber-50 text-amber-800",
  success: "border-[rgb(var(--accent)/0.25)] bg-[rgb(var(--accent-soft))] text-[rgb(var(--accent-text))]",
  danger: "border-red-200 bg-red-50 text-red-700",
  muted: "border-zinc-200 bg-zinc-100 text-zinc-700",
};

const classes = {
  wrap: "card px-4 py-4 hover:shadow-[var(--shadow-md)] sm:px-6 sm:py-5",
  topRow: "flex items-center justify-between gap-3",
  eyebrow: "text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500",
  titleRow: "mt-1 flex flex-wrap items-center gap-x-3 gap-y-1",
  title: "min-w-0 font-display text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl",
  status: "inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
  meta: "mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-sm text-zinc-600",
  metaDot: "text-zinc-300",
  notice: "mt-3",

  track: "mt-4 hidden grid-flow-col auto-cols-fr gap-2 sm:grid",
  stage: "border-t-[3px] pt-2 text-xs font-medium",
  stageDone: "border-[rgb(var(--accent)/0.55)] text-zinc-500",
  stageCurrent: "border-[rgb(var(--brand))] text-zinc-900",
  stageUpcoming: "border-zinc-200 text-zinc-400",

  compact: "mt-4 sm:hidden",
  compactLabel: "flex items-center justify-between text-xs font-medium text-zinc-600",
  compactBar: "mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-200",
  compactFill: "h-full rounded-full bg-gradient-to-r from-[rgb(var(--accent))] to-[rgb(var(--brand))]",
} as const;

const stageClass = (state: RequestStage["state"]) =>
  state === "done"
    ? classes.stageDone
    : state === "current"
      ? classes.stageCurrent
      : classes.stageUpcoming;

const RequestWorkspaceHeader = ({
  backTo,
  backLabel,
  eyebrow,
  title,
  meta,
  statusLabel,
  statusTone,
  stages,
  actions,
  notice,
}: RequestWorkspaceHeaderProps) => {
  const currentIndex = stages.findIndex((stage) => stage.state === "current");
  const doneCount = stages.filter((stage) => stage.state === "done").length;
  const position = currentIndex >= 0 ? currentIndex + 1 : doneCount;
  const current = stages[currentIndex] ?? stages[stages.length - 1];
  const progress = stages.length ? Math.round((Math.max(position, doneCount) / stages.length) * 100) : 0;

  return (
    <header className={classes.wrap}>
      <div className={classes.topRow}>
        <Link to={backTo} className="backLink">
          ← {backLabel}
        </Link>

        {actions}
      </div>

      <div className="mt-3">
        <div className={classes.eyebrow}>{eyebrow}</div>

        <div className={classes.titleRow}>
          <h1 className={classes.title}>{title}</h1>
          <span className={`${classes.status} ${statusToneClass[statusTone]}`}>{statusLabel}</span>
        </div>

        {meta.length > 0 && (
          <div className={classes.meta}>
            {meta.map((item, index) => (
              <span key={index} className="inline-flex items-center gap-2">
                {index > 0 && (
                  <span className={classes.metaDot} aria-hidden="true">
                    •
                  </span>
                )}
                {item}
              </span>
            ))}
          </div>
        )}
      </div>

      {notice && <div className={classes.notice}>{notice}</div>}

      {stages.length > 0 && (
        <>
          <ol className={classes.track} aria-label="Project progress">
            {stages.map((stage) => (
              <li
                key={stage.key}
                className={`${classes.stage} ${stageClass(stage.state)}`}
                aria-current={stage.state === "current" ? "step" : undefined}
              >
                {stage.state === "done" && <span aria-hidden="true">✓ </span>}
                {stage.label}
              </li>
            ))}
          </ol>

          <div className={classes.compact} aria-hidden="true">
            <div className={classes.compactLabel}>
              <span>{current?.label}</span>
              <span>
                Step {Math.max(position, 1)} of {stages.length}
              </span>
            </div>
            <div className={classes.compactBar}>
              <div className={classes.compactFill} style={{ width: `${progress}%` }} />
            </div>
          </div>
        </>
      )}
    </header>
  );
};

export default RequestWorkspaceHeader;
