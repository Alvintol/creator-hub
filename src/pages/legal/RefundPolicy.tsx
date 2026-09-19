import LegalPolicySections from "../../components/legal/LegalPolicySections";
import {
  refundPolicySections,
  refundPolicyVersion,
} from "../../domain/legal/refundPolicy";

const RefundPolicy = () => {
  return (
    <LegalPolicySections
      title="Refund, Cancellation and Dispute Policy"
      subtitle="How cancellations, partial refunds, revisions and disputes work on CreatorHub."
      sections={refundPolicySections}
      version={refundPolicyVersion}
    />
  );
};

export default RefundPolicy;
