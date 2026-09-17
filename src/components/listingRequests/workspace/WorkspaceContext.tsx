import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { RequestWorkspaceSectionId } from "../../../domain/listings/requestWorkspace";

export type WorkspaceMobileTab = "messages" | "project";

type FocusRequest = { id: RequestWorkspaceSectionId; nonce: number } | null;

type WorkspaceContextValue = {
  mobileTab: WorkspaceMobileTab;
  setMobileTab: (tab: WorkspaceMobileTab) => void;
  focusRequest: FocusRequest;
  focusSection: (id: RequestWorkspaceSectionId) => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export const WorkspaceProvider = ({ children }: { children: ReactNode }) => {
  const [mobileTab, setMobileTab] = useState<WorkspaceMobileTab>("messages");
  const [focusRequest, setFocusRequest] = useState<FocusRequest>(null);

  const focusSection = useCallback((id: RequestWorkspaceSectionId) => {
    setMobileTab("project");
    setFocusRequest((current) => ({ id, nonce: (current?.nonce ?? 0) + 1 }));
  }, []);

  const value = useMemo(
    () => ({ mobileTab, setMobileTab, focusRequest, focusSection }),
    [mobileTab, focusRequest, focusSection]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
};

export const useWorkspace = (): WorkspaceContextValue => {
  const context = useContext(WorkspaceContext);

  if (!context) {
    throw new Error("useWorkspace must be used inside WorkspaceProvider.");
  }

  return context;
};
