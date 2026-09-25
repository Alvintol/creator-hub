import LegalPolicySections from "../../components/legal/LegalPolicySections";
import {
  serviceProviderRegisterSections,
  serviceProviderRegisterVersion,
} from "../../domain/legal/serviceProviderRegister";

const ServiceProviderRegister = () => {
  return (
    <LegalPolicySections
      title="Service Provider Register"
      subtitle="The providers that process personal information for Made for Stream, what each does, and where."
      sections={serviceProviderRegisterSections}
      version={serviceProviderRegisterVersion}
    />
  );
};

export default ServiceProviderRegister;
