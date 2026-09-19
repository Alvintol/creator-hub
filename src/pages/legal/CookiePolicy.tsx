import LegalPolicySections from "../../components/legal/LegalPolicySections";
import {
  cookiePolicySections,
  cookiePolicyVersion,
} from "../../domain/legal/cookiePolicy";

const CookiePolicy = () => {
  return (
    <LegalPolicySections
      title="Cookie and Tracking Policy"
      subtitle="Browser storage, optional tracking categories, and how to change your choices."
      sections={cookiePolicySections}
      version={cookiePolicyVersion}
    />
  );
};

export default CookiePolicy;
