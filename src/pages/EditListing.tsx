import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../providers/AuthProvider";
import { useMyListing } from "../hooks/useMyListing";

type ListingOfferingType = "digital" | "commission" | "service";
type ListingPriceType = "fixed" | "starting_at" | "range";
type ListingVideoSubtype = "" | "long-form" | "short-form";

type FormState = {
  title: string;
  short: string;
  offeringType: ListingOfferingType;
  category: string;
  videoSubtype: ListingVideoSubtype;
  priceType: ListingPriceType;
  priceMin: string;
  priceMax: string;
  deliverablesText: string;
  tagsText: string;
  previewUrl: string;
};

type FormErrors = Partial<Record<keyof FormState, string>> & {
  submit?: string;
};

const classes = {
  page: "space-y-6",
  backLink: "text-sm font-semibold text-zinc-600 hover:text-zinc-900",

  header: "space-y-1",
  h1: "text-2xl font-extrabold tracking-tight",
  sub: "text-sm text-zinc-600",

  card: "card p-6",
  section: "space-y-4",
  sectionTitle: "text-base font-extrabold tracking-tight",
  sectionText: "text-sm text-zinc-600",

  grid: "grid gap-4 md:grid-cols-2",
  full: "md:col-span-2",

  field: "space-y-2",
  label: "text-sm font-bold text-zinc-900",
  hint: "text-xs text-zinc-500",
  error: "text-xs font-semibold text-red-600",

  input:
    "w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200",
  textarea:
    "min-h-[120px] w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200",
  select:
    "w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200",

  infoBox: "rounded-2xl border border-zinc-200 bg-zinc-50 p-4",
  infoTitle: "text-sm font-bold text-zinc-900",
  infoText: "mt-1 text-sm text-zinc-600",

  submitError:
    "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",
  row: "flex flex-wrap items-center gap-3",
  btnPrimary:
    "inline-flex items-center justify-center rounded-full border border-[rgb(var(--brand))] bg-[rgb(var(--brand))] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(244,92,44,0.28)] transition-all duration-200 hover:-translate-y-[1px] hover:brightness-105 hover:shadow-[0_8px_22px_rgba(244,92,44,0.34)] disabled:cursor-not-allowed disabled:opacity-60",
  btnOutline:
    "inline-flex items-center justify-center rounded-full border border-zinc-400 bg-white px-5 py-3 text-sm font-bold text-zinc-900 shadow-[0_3px_10px_rgba(0,0,0,0.07)] transition-all duration-200 hover:-translate-y-[1px] hover:border-zinc-500 hover:bg-zinc-50 hover:shadow-[0_6px_18px_rgba(0,0,0,0.11)] disabled:cursor-not-allowed disabled:opacity-60",

  loadingText: "text-sm text-zinc-600",
} as const;

const offeringTypeOptions: Array<{
  value: ListingOfferingType;
  label: string;
}> = [
    { value: "digital", label: "Digital" },
    { value: "commission", label: "Commission" },
    { value: "service", label: "Service" },
  ];

const priceTypeOptions: Array<{
  value: ListingPriceType;
  label: string;
}> = [
    { value: "fixed", label: "Fixed price" },
    { value: "starting_at", label: "Starting at" },
    { value: "range", label: "Price range" },
  ];

const videoSubtypeOptions: Array<{
  value: ListingVideoSubtype;
  label: string;
}> = [
    { value: "", label: "None" },
    { value: "long-form", label: "Long-form" },
    { value: "short-form", label: "Short-form" },
  ];

const initialState: FormState = {
  title: "",
  short: "",
  offeringType: "digital",
  category: "",
  videoSubtype: "",
  priceType: "fixed",
  priceMin: "",
  priceMax: "",
  deliverablesText: "",
  tagsText: "",
  previewUrl: "",
};

// Splits newline-separated deliverables into a clean array
const parseDeliverables = (value: string) =>
  value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

// Splits comma-separated tags into a clean array
const parseTags = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

// Keeps only whole-number digits for price inputs
const normaliseIntegerInput = (value: string) =>
  value.replace(/[^\d]/g, "");

// Parses an integer field while keeping empty input as null
const parseInteger = (value: string) => {
  if (!value.trim()) return null;

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

// Maps a loaded listing row into editable form state
const toFormState = (listing: {
  title: string;
  short: string;
  offering_type: ListingOfferingType;
  category: string;
  video_subtype: "long-form" | "short-form" | null;
  price_type: ListingPriceType;
  price_min: number;
  price_max: number | null;
  deliverables: string[];
  tags: string[];
  preview_url: string | null;
}): FormState => ({
  title: listing.title,
  short: listing.short,
  offeringType: listing.offering_type,
  category: listing.category,
  videoSubtype: listing.video_subtype ?? "",
  priceType: listing.price_type,
  priceMin: String(listing.price_min),
  priceMax:
    listing.price_type === "range" && listing.price_max !== null
      ? String(listing.price_max)
      : "",
  deliverablesText: listing.deliverables.join("\n"),
  tagsText: listing.tags.join(", "),
  previewUrl: listing.preview_url ?? "",
});

const EditListing = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const { data: listing, isLoading, error } = useMyListing(id ?? null);

  const [form, setForm] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [hasLoadedForm, setHasLoadedForm] = useState(false);

  useEffect(() => {
    if (!listing || hasLoadedForm) return;

    setForm(toFormState(listing));
    setHasLoadedForm(true);
  }, [listing, hasLoadedForm]);

  const isRangePrice = form.priceType === "range";

  const deliverablePreview = useMemo(
    () => parseDeliverables(form.deliverablesText),
    [form.deliverablesText]
  );

  const tagPreview = useMemo(() => parseTags(form.tagsText), [form.tagsText]);

  const setField = <Key extends keyof FormState>(key: Key, value: FormState[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined, submit: undefined }));
  };

  const setPriceType = (value: ListingPriceType) => {
    setForm((current) => ({
      ...current,
      priceType: value,
      priceMax: value === "range" ? current.priceMax : "",
    }));

    setErrors((current) => ({
      ...current,
      priceMax: undefined,
      submit: undefined,
    }));
  };

  const validate = () => {
    const nextErrors: FormErrors = {};

    const title = form.title.trim();
    const short = form.short.trim();
    const category = form.category.trim();

    const priceMin = parseInteger(form.priceMin);
    const rawPriceMax =
      form.priceType === "range" ? parseInteger(form.priceMax) : null;

    if (title.length < 3 || title.length > 80) {
      nextErrors.title = "Title must be between 3 and 80 characters.";
    }

    if (short.length < 10 || short.length > 280) {
      nextErrors.short = "Short description must be between 10 and 280 characters.";
    }

    if (!category) {
      nextErrors.category = "Category is required.";
    }

    if (priceMin === null || priceMin < 0) {
      nextErrors.priceMin = "Price min must be 0 or greater.";
    }

    if (form.priceType === "range") {
      if (rawPriceMax === null) {
        nextErrors.priceMax = "Price max is required for a range listing.";
      } else if (priceMin !== null && rawPriceMax < priceMin) {
        nextErrors.priceMax = "Price max must be greater than or equal to price min.";
      }
    } else if (rawPriceMax !== null && priceMin !== null && rawPriceMax < priceMin) {
      nextErrors.priceMax = "Price max must be greater than or equal to price min.";
    }

    if (
      form.videoSubtype &&
      form.videoSubtype !== "long-form" &&
      form.videoSubtype !== "short-form"
    ) {
      nextErrors.videoSubtype = "Video subtype must be long-form or short-form.";
    }

    setErrors(nextErrors);

    return {
      isValid: Object.keys(nextErrors).length === 0,
      priceMin,
      rawPriceMax,
    };
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const { isValid, priceMin, rawPriceMax } = validate();
    if (!isValid || !user?.id || !id || priceMin === null) return;

    setIsSaving(true);

    try {
      const nextPriceMax =
        form.priceType === "fixed"
          ? priceMin
          : form.priceType === "starting_at"
            ? null
            : rawPriceMax;

      const { data: updated, error: updateError } = await supabase
        .from("listings")
        .update({
          title: form.title.trim(),
          short: form.short.trim(),
          offering_type: form.offeringType,
          category: form.category.trim(),
          video_subtype: form.videoSubtype || null,
          price_type: form.priceType,
          price_min: priceMin,
          price_max: nextPriceMax,
          deliverables: parseDeliverables(form.deliverablesText),
          tags: parseTags(form.tagsText),
          preview_url: form.previewUrl.trim() || null,
          status: "draft",
          is_active: false,
        })
        .eq("id", id)
        .eq("user_id", user.id)
        .eq("status", "draft")
        .select("id")
        .maybeSingle();

      if (updateError) {
        throw updateError;
      }

      if (!updated?.id) {
        throw new Error("Only draft listings can be edited right now.");
      }

      navigate("/creator/listings");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The listing draft could not be updated.";

      setErrors((current) => ({
        ...current,
        submit: message,
      }));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className={classes.loadingText}>Loading…</div>;
  }

  if (error || !listing) {
    return (
      <div className={classes.page}>
        <Link to="/creator/listings" className={classes.backLink}>
          ← Back to my listings
        </Link>

        <div className={classes.card}>
          <h1 className={classes.h1}>Listing not found</h1>
          <p className={classes.sub}>
            This listing could not be loaded from your creator account.
          </p>
        </div>
      </div>
    );
  }

  if (listing.status !== "draft" || listing.is_active) {
    return (
      <div className={classes.page}>
        <Link to="/creator/listings" className={classes.backLink}>
          ← Back to my listings
        </Link>

        <div className={classes.card}>
          <h1 className={classes.h1}>Draft-only editing</h1>
          <p className={classes.sub}>
            Only inactive draft listings can be edited in this first pass.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={classes.page}>
      <Link to="/creator/listings" className={classes.backLink}>
        ← Back to my listings
      </Link>

      <div className={classes.header}>
        <h1 className={classes.h1}>Edit draft listing</h1>

        <p className={classes.sub}>
          Update your private draft listing. Publishing and activation are still
          intentionally out of scope here.
        </p>
      </div>

      <form className={classes.card} onSubmit={handleSubmit}>
        <div className={classes.section}>
          <div>
            <h2 className={classes.sectionTitle}>Basics</h2>
            <p className={classes.sectionText}>
              Edit the core listing details that will later feed the public view.
            </p>
          </div>

          <div className={classes.grid}>
            <div className={`${classes.field} ${classes.full}`}>
              <label className={classes.label} htmlFor="title">
                Title
              </label>

              <input
                id="title"
                className={classes.input}
                type="text"
                value={form.title}
                onChange={(event) => setField("title", event.target.value)}
                maxLength={80}
              />

              <div className={classes.hint}>3 to 80 characters.</div>

              {errors.title && <div className={classes.error}>{errors.title}</div>}
            </div>

            <div className={`${classes.field} ${classes.full}`}>
              <label className={classes.label} htmlFor="short">
                Short description
              </label>

              <textarea
                id="short"
                className={classes.textarea}
                value={form.short}
                onChange={(event) => setField("short", event.target.value)}
                maxLength={280}
              />

              <div className={classes.hint}>10 to 280 characters.</div>

              {errors.short && <div className={classes.error}>{errors.short}</div>}
            </div>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="offeringType">
                Offering type
              </label>

              <select
                id="offeringType"
                className={classes.select}
                value={form.offeringType}
                onChange={(event) =>
                  setField("offeringType", event.target.value as ListingOfferingType)
                }
              >
                {offeringTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="category">
                Category
              </label>

              <input
                id="category"
                className={classes.input}
                type="text"
                value={form.category}
                onChange={(event) => setField("category", event.target.value)}
              />

              {errors.category && (
                <div className={classes.error}>{errors.category}</div>
              )}
            </div>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="videoSubtype">
                Video subtype
              </label>

              <select
                id="videoSubtype"
                className={classes.select}
                value={form.videoSubtype}
                onChange={(event) =>
                  setField("videoSubtype", event.target.value as ListingVideoSubtype)
                }
              >
                {videoSubtypeOptions.map((option) => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <div className={classes.hint}>
                Leave empty unless this listing is for video work.
              </div>

              {errors.videoSubtype && (
                <div className={classes.error}>{errors.videoSubtype}</div>
              )}
            </div>
          </div>
        </div>

        <div className={classes.section}>
          <div>
            <h2 className={classes.sectionTitle}>Pricing</h2>
            <p className={classes.sectionText}>
              Draft updates keep the listing private and inactive.
            </p>
          </div>

          <div className={classes.grid}>
            <div className={classes.field}>
              <label className={classes.label} htmlFor="priceType">
                Price type
              </label>

              <select
                id="priceType"
                className={classes.select}
                value={form.priceType}
                onChange={(event) =>
                  setPriceType(event.target.value as ListingPriceType)
                }
              >
                {priceTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="priceMin">
                {isRangePrice ? "Price min" : "Price"}
              </label>

              <input
                id="priceMin"
                className={classes.input}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={form.priceMin}
                onChange={(event) =>
                  setField("priceMin", normaliseIntegerInput(event.target.value))
                }
              />

              {errors.priceMin && (
                <div className={classes.error}>{errors.priceMin}</div>
              )}
            </div>

            {isRangePrice && (
              <div className={classes.field}>
                <label className={classes.label} htmlFor="priceMax">
                  Price max
                </label>

                <input
                  id="priceMax"
                  className={classes.input}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={form.priceMax}
                  onChange={(event) =>
                    setField("priceMax", normaliseIntegerInput(event.target.value))
                  }
                />

                <div className={classes.hint}>
                  Required only when price type is set to range.
                </div>

                {errors.priceMax && (
                  <div className={classes.error}>{errors.priceMax}</div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className={classes.section}>
          <div>
            <h2 className={classes.sectionTitle}>Deliverables and tags</h2>
            <p className={classes.sectionText}>
              These stay optional and are trimmed before saving.
            </p>
          </div>

          <div className={classes.grid}>
            <div className={classes.field}>
              <label className={classes.label} htmlFor="deliverablesText">
                Deliverables
              </label>

              <textarea
                id="deliverablesText"
                className={classes.textarea}
                value={form.deliverablesText}
                onChange={(event) =>
                  setField("deliverablesText", event.target.value)
                }
              />

              <div className={classes.hint}>Enter one deliverable per line.</div>
            </div>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="tagsText">
                Tags
              </label>

              <textarea
                id="tagsText"
                className={classes.textarea}
                value={form.tagsText}
                onChange={(event) => setField("tagsText", event.target.value)}
              />

              <div className={classes.hint}>Separate tags with commas.</div>
            </div>

            <div className={`${classes.infoBox} ${classes.full}`}>
              <div className={classes.infoTitle}>Parsed preview</div>

              <div className={classes.infoText}>
                Deliverables:{" "}
                {deliverablePreview.length > 0
                  ? deliverablePreview.join(", ")
                  : "None"}
              </div>

              <div className={classes.infoText}>
                Tags: {tagPreview.length > 0 ? tagPreview.join(", ") : "None"}
              </div>
            </div>
          </div>
        </div>

        <div className={classes.section}>
          <div>
            <h2 className={classes.sectionTitle}>Preview</h2>
            <p className={classes.sectionText}>
              Preview URLs remain optional until uploads are introduced.
            </p>
          </div>

          <div className={classes.grid}>
            <div className={`${classes.field} ${classes.full}`}>
              <label className={classes.label} htmlFor="previewUrl">
                Preview URL
              </label>

              <input
                id="previewUrl"
                className={classes.input}
                type="text"
                value={form.previewUrl}
                onChange={(event) => setField("previewUrl", event.target.value)}
              />
            </div>
          </div>
        </div>

        <div className={classes.section}>
          <div className={classes.infoBox}>
            <div className={classes.infoTitle}>Update behaviour</div>

            <div className={classes.infoText}>
              Saving keeps this listing in private draft mode:
              <strong> status = draft</strong> and <strong>is_active = false</strong>.
            </div>
          </div>

          {errors.submit && (
            <div className={classes.submitError}>{errors.submit}</div>
          )}

          <div className={classes.row}>
            <button className={classes.btnPrimary} type="submit" disabled={isSaving}>
              {isSaving ? "Saving changes…" : "Save changes"}
            </button>

            <Link className={classes.btnOutline} to="/creator/listings">
              Cancel
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
};

export default EditListing;