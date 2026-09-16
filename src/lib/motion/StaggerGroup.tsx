import { useRef, type ReactNode } from "react";
import { useStaggerIn } from "./useStaggerIn";

type StaggerGroupProps = {
  itemCount: number;
  resetKey?: string | null;
  className?: string;
  children: ReactNode;
};

const StaggerGroup = ({ itemCount, resetKey = null, className, children }: StaggerGroupProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useStaggerIn(containerRef, itemCount, { resetKey });

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
};

export default StaggerGroup;
