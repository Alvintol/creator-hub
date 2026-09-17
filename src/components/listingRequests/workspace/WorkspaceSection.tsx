import type { ReactNode } from "react";
import type { RequestWorkspaceSectionId } from "../../../domain/listings/requestWorkspace";
import CollapsibleSection from "../../ui/CollapsibleSection";
import { useWorkspace } from "./WorkspaceContext";

type WorkspaceSectionProps = {
  id: RequestWorkspaceSectionId;
  title: string;
  summary?: ReactNode;
  attention?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
};

const WorkspaceSection = ({ id, ...props }: WorkspaceSectionProps) => {
  const { focusRequest } = useWorkspace();

  return (
    <CollapsibleSection
      {...props}
      id={`request-section-${id}`}
      focusKey={focusRequest?.id === id ? focusRequest.nonce : null}
    />
  );
};

export default WorkspaceSection;
