export type SellerApplicationSampleType = "link" | "image" | "video";

export type SellerApplicationSampleInput = {
  id?: string;
  sample_type: SellerApplicationSampleType;
  title: string;
  description?: string | null;
  url?: string | null;
  storage_path?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  file_size_bytes?: number | null;
};

export const SELLER_APPLICATION_MIN_SAMPLES = 3;
export const SELLER_APPLICATION_MAX_SAMPLES = 10;
export const SELLER_APPLICATION_MAX_VIDEO_SAMPLES = 1;
export const SELLER_APPLICATION_MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export type SellerApplicationValidationResult = {
  isValid: boolean;
  errors: string[];
};

const isBlank = (value?: string | null): boolean => !value || !value.trim();

export const validateSellerApplicationSamples = (
  samples: SellerApplicationSampleInput[]
): SellerApplicationValidationResult => {
  const errors: string[] = [];

  if (samples.length < SELLER_APPLICATION_MIN_SAMPLES) {
    errors.push("Add at least 3 work samples before submitting.");
  }

  if (samples.length > SELLER_APPLICATION_MAX_SAMPLES) {
    errors.push("You can submit up to 10 work samples.");
  }

  const videoCount = samples.filter(
    (sample) => sample.sample_type === "video"
  ).length;

  if (videoCount > SELLER_APPLICATION_MAX_VIDEO_SAMPLES) {
    errors.push("Only 1 video upload is allowed per application.");
  }

  samples.forEach((sample, index) => {
    const label = `Sample ${index + 1}`;

    if (isBlank(sample.title)) {
      errors.push(`${label} needs a title.`);
    }

    if (sample.sample_type === "link") {
      if (isBlank(sample.url)) {
        errors.push(`${label} needs a portfolio or work link.`);
      }
    }

    if (sample.sample_type === "image" || sample.sample_type === "video") {
      if (isBlank(sample.storage_path)) {
        errors.push(`${label} is missing uploaded file data.`);
      }

      if (
        typeof sample.file_size_bytes === "number" &&
        sample.file_size_bytes > SELLER_APPLICATION_MAX_FILE_SIZE_BYTES
      ) {
        errors.push(`${label} exceeds the 50 MB upload limit.`);
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
};