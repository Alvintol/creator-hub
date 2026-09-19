import LegalPolicySections from "../../components/legal/LegalPolicySections";
import {
  communityGuidelinesSections,
  communityGuidelinesVersion,
} from "../../domain/legal/communityGuidelines";

const CommunityGuidelines = () => {
  return (
    <LegalPolicySections
      title="Community Guidelines"
      subtitle="Plain-language standards for listings, messages, mature content, and moderation."
      sections={communityGuidelinesSections}
      version={communityGuidelinesVersion}
    />
  );
};

export default CommunityGuidelines;
