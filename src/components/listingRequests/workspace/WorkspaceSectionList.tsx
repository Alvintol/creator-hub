import type { RequestWorkspaceSectionId } from "../../../domain/listings/requestWorkspace";
import { getSectionOrder, orderSections, type WorkspaceSectionSpec } from "./sectionSummaries";
import WorkspaceSection from "./WorkspaceSection";

type WorkspaceSectionListProps = {
  requestStatus: string;
  sections: WorkspaceSectionSpec[];
  order?: RequestWorkspaceSectionId[];
};

const WorkspaceSectionList = ({ requestStatus, sections, order }: WorkspaceSectionListProps) => (
  <>
    {orderSections(sections, order ?? getSectionOrder(requestStatus)).map((section) => (
      <WorkspaceSection
        key={section.id}
        id={section.id}
        title={section.title}
        summary={section.summary}
        attention={section.attention}
        defaultOpen={section.defaultOpen}
      >
        {section.content}
      </WorkspaceSection>
    ))}
  </>
);

export default WorkspaceSectionList;
