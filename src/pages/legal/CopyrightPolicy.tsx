import LegalPolicySections from "../../components/legal/LegalPolicySections";
import {
  copyrightPolicySections,
  copyrightPolicyVersion,
} from "../../domain/legal/copyrightPolicy";

const CopyrightPolicy = () => {
  return (
    <LegalPolicySections
      title="Copyright Infringement and DMCA Policy"
      subtitle="How to report infringing material, submit a counter-notice, and how Made for Stream responds."
      sections={copyrightPolicySections}
      version={copyrightPolicyVersion}
    />
  );
};

export default CopyrightPolicy;
