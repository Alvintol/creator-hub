import LegalPolicySections from "../../components/legal/LegalPolicySections";
import {
  paymentTermsSections,
  paymentTermsVersion,
} from "../../domain/legal/paymentTerms";

const FeeSchedule = () => {
  return (
    <LegalPolicySections
      title="Fee Schedule and Payment Terms"
      subtitle="What buyers pay, what creators receive, and how Made for Stream's fees are calculated."
      sections={paymentTermsSections}
      version={paymentTermsVersion}
    />
  );
};

export default FeeSchedule;
