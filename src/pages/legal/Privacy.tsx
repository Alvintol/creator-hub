import LegalPolicySections from "../../components/legal/LegalPolicySections";
import { privacySections, privacyVersion } from "../../domain/legal/privacyPolicy";

// Uses the shared renderer so the Service Provider Register reference in
// sections 4 and 11 is a working link and the information tables render as
// tables.
const Privacy = () => {
  return (
    <LegalPolicySections
      title="Privacy Policy"
      subtitle="How Made for Stream handles personal information."
      sections={privacySections}
      version={privacyVersion}
    />
  );
};

export default Privacy;
