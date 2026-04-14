import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../providers/AuthProvider";
import { useSellerAccess } from "../hooks/useSellerAccess";
import { useUpsertMySellerApplication } from "../hooks/useUpsertMySellerApplication";

type SellerApplicationSampleType = "link" | "image" | "video";

type SellerApplicationSampleRow = {
  id: string;
  application_id: string;
  sample_type: SellerApplicationSampleType;
  title: string;
  description: string | null;
  url: string | null;
  storage_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

const classes = {
  page: "space-y-6",
  header: "space-y-1",
  h1: "text-2xl font-extrabold tracking-tight",
  sub: "text-sm text-zinc-600",

  card: "card p-6",
  cardTitle: "text-base font-extrabold tracking-tight",
  cardText: "mt-1 text-sm text-zinc-600",

  bannerInfo: "card border border-sky-200 bg-sky-50 p-4 text-sky-900",
  bannerOk: "card border border-emerald-200 bg-emerald-50 p-4 text-emerald-900",
  bannerErr: "card border border-rose-200 bg-rose-50 p-4 text-rose-900",
  bannerTitle: "text-sm font-extrabold",
  bannerText: "mt-1 text-sm",

  statusGrid: "mt-4 grid gap-3 md:grid-cols-3",
  statusCard: "rounded-2xl border border-zinc-200 bg-white p-4",
  statusLabel: "text-xs font-bold uppercase tracking-wide text-zinc-500",
  statusValue: "mt-1 text-sm font-semibold text-zinc-900",
  statusHelp: "mt-1 text-xs text-zinc-500",

  checklist: "mt-4 space-y-2 text-sm text-zinc-700",
  checklistItem: "flex items-start gap-2",
  checklistDot: "mt-[6px] h-2 w-2 rounded-full bg-zinc-400",
  checklistOkDot: "mt-[6px] h-2 w-2 rounded-full bg-emerald-500",

  row: "mt-5 flex flex-wrap items-center gap-3",
  btnPrimary:
    "inline-flex items-center justify-center rounded-full border border-[rgb(var(--brand))] bg-[rgb(var(--brand))] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(244,92,44,0.28)] transition-all duration-200 hover:-translate-y-[1px] hover:brightness-105 hover:shadow-[0_8px_22px_rgba(244,92,44,0.34)] disabled:cursor-not-allowed disabled:opacity-60",
  btnOutline:
    "inline-flex items-center justify-center rounded-full border border-zinc-400 bg-white px-5 py-3 text-sm font-bold text-zinc-900 shadow-[0_3px_10px_rgba(0,0,0,0.07)] transition-all duration-200 hover:-translate-y-[1px] hover:border-zinc-500 hover:bg-zinc-50 hover:shadow-[0_6px_18px_rgba(0,0,0,0.11)] disabled:cursor-not-allowed disabled:opacity-60",
  btnDanger:
    "inline-flex items-center justify-center rounded-full border border-rose-300 bg-white px-4 py-2 text-sm font-bold text-rose-700 transition-all duration-200 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60",

  samplesHeader: "mt-4 flex flex-wrap items-center justify-between gap-3",
  sampleCount: "text-sm font-semibold text-zinc-900",
  sampleHelp: "text-xs text-zinc-500",

  formGrid: "mt-4 grid gap-4",
  field: "space-y-2",
  label: "text-sm font-extrabold text-zinc-800",
  input: "searchInput",
  textarea:
    "w-full rounded-xl bg-white px-4 py-3 text-sm outline-none transition ring-1 ring-zinc-300/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/70",
  fieldHelp: "text-xs text-zinc-500",

  sampleList: "mt-4 space-y-3",
  sampleCard: "rounded-2xl border border-zinc-200 bg-white p-4",
  sampleTopRow: "flex flex-wrap items-start justify-between gap-3",
  sampleTitle: "text-sm font-extrabold text-zinc-900",
  sampleMeta: "mt-1 text-xs text-zinc-500",
  sampleDescription: "mt-2 text-sm text-zinc-700",
  sampleLink: "mt-2 inline-flex text-sm font-semibold text-[rgb(var(--brand))] underline",

  chips: "mt-3 flex flex-wrap gap-2",
  chip: "chip",
  chipMuted: "chip opacity-70",

  divider: "my-4 border-t border-zinc-200",
  loadingText: "text-sm text-zinc-600",
} as const;

// Turns unknown thrown values into readable text
const getErrorMessage = (error: unknown): string =>
  error && typeof error === "object" && "message" in error
    ? String((error as { message: unknown }).message)
    : "Something went wrong.";

// Validates that a string looks like an absolute URL
const isValidUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const normaliseUrlInput = (value: string): string => {
  const trimmedValue = value.trim();

  if (!trimmedValue) return "";

  const hasProtocol = /^[a-z]+:\/\//i.test(trimmedValue);

  return hasProtocol ? trimmedValue : `https://${trimmedValue}`;
};

const getUrlValidationError = (value: string): string | null => {
  const trimmedValue = value.trim();

  if (!trimmedValue) return null;

  const normalisedValue = normaliseUrlInput(trimmedValue);

  return isValidUrl(normalisedValue)
    ? null
    : "Enter a valid public URL. CreatorHub can add https:// automatically, but the link still needs to be valid.";
};

const getDisplayUrl = (value: string): string => {
  const trimmedValue = value.trim();
  if (!trimmedValue) return "";

  return normaliseUrlInput(trimmedValue);
};

// Loads the current application's samples
const fetchSellerApplicationSamples = async (
  applicationId: string
): Promise<SellerApplicationSampleRow[]> => {
  const { data, error } = await supabase
    .from("seller_application_samples")
    .select(`
      id,
      application_id,
      sample_type,
      title,
      description,
      url,
      storage_path,
      file_name,
      mime_type,
      file_size_bytes,
      sort_order,
      created_at,
      updated_at
    `)
    .eq("application_id", applicationId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []) as SellerApplicationSampleRow[];
};

// Creates a new link sample row
const insertLinkSample = async (
  applicationId: string,
  input: {
    title: string;
    description: string;
    url: string;
    sortOrder: number;
  }
): Promise<SellerApplicationSampleRow> => {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("seller_application_samples")
    .insert({
      application_id: applicationId,
      sample_type: "link",
      title: input.title,
      description: input.description || null,
      url: input.url,
      sort_order: input.sortOrder,
      updated_at: now,
    })
    .select(`
      id,
      application_id,
      sample_type,
      title,
      description,
      url,
      storage_path,
      file_name,
      mime_type,
      file_size_bytes,
      sort_order,
      created_at,
      updated_at
    `)
    .single();

  if (error) throw error;

  return data as SellerApplicationSampleRow;
};

// Deletes one sample row
const removeSellerApplicationSample = async (sampleId: string) => {
  const { error } = await supabase
    .from("seller_application_samples")
    .delete()
    .eq("id", sampleId);

  if (error) throw error;
};

// Submits the current draft / needs-changes application for review
const submitSellerApplication = async (
  profileUserId: string,
  applicationId: string,
  sampleCount: number,
  videoCount: number
) => {
  if (sampleCount < 3) {
    throw new Error("Add at least 3 work samples before submitting.");
  }

  if (sampleCount > 10) {
    throw new Error("You can submit a maximum of 10 work samples.");
  }

  if (videoCount > 1) {
    throw new Error("Only 1 video sample is allowed per application.");
  }

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("seller_applications")
    .update({
      status: "submitted",
      submitted_at: now,
      updated_at: now,
    })
    .eq("id", applicationId)
    .eq("profile_user_id", profileUserId)
    .select("id")
    .single();

  if (error) throw error;

  return data;
};

const requiredRecentUploadTitle = "Most Recent Upload/Vod";

const requiredRecentUploadDescription =
  "Link to your most recent public upload, VOD, or equivalent recent creator work.";

const isRequiredRecentUploadSample = (
  sample: SellerApplicationSampleRow
): boolean =>
  sample.sample_type === "link" &&
  sample.title.trim().toLowerCase() === requiredRecentUploadTitle.toLowerCase();

const saveRequiredRecentUploadSample = async (
  input: {
    applicationId: string;
    sampleId?: string;
    url: string;
    sortOrder: number;
  }
): Promise<SellerApplicationSampleRow> => {
  const now = new Date().toISOString();

  if (input.sampleId) {
    const { data, error } = await supabase
      .from("seller_application_samples")
      .update({
        title: requiredRecentUploadTitle,
        description: requiredRecentUploadDescription,
        url: input.url,
        updated_at: now,
      })
      .eq("id", input.sampleId)
      .select(`
        id,
        application_id,
        sample_type,
        title,
        description,
        url,
        storage_path,
        file_name,
        mime_type,
        file_size_bytes,
        sort_order,
        created_at,
        updated_at
      `)
      .single();

    if (error) throw error;

    return data as SellerApplicationSampleRow;
  }

  return insertLinkSample(input.applicationId, {
    title: requiredRecentUploadTitle,
    description: requiredRecentUploadDescription,
    url: input.url,
    sortOrder: input.sortOrder,
  });
};

const ApplyCreator = () => {
  const queryClient = useQueryClient();
  const { user, loading } = useAuth();

  const {
    isLoading: isAccessLoading,
    profileReady,
    hasLinkedCreatorPlatform,
    sellerApplication,
    creatorStatusLabel,
    canStartApplication,
    canEditApplication,
    canSubmitApplication,
    error: sellerAccessError,
  } = useSellerAccess();

  const createDraftMutation = useUpsertMySellerApplication();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [mostRecentUploadUrl, setMostRecentUploadUrl] = useState("");

  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(
    "Links are strongly preferred right now. Image and video uploads can be enabled once storage is wired."
  );

  const applicationId = sellerApplication?.id ?? null;

  const {
    data: samples = [],
    isLoading: isSamplesLoading,
    error: samplesError,
  } = useQuery<SellerApplicationSampleRow[]>({
    queryKey: ["mySellerApplicationSamples", applicationId],
    enabled: Boolean(applicationId),
    staleTime: 30_000,
    queryFn: () =>
      applicationId
        ? fetchSellerApplicationSamples(applicationId)
        : Promise.resolve([]),
  });



  const addLinkSampleMutation = useMutation({
    mutationFn: (input: {
      applicationId: string;
      title: string;
      description: string;
      url: string;
      sortOrder: number;
    }) => insertLinkSample(input.applicationId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["mySellerApplicationSamples", applicationId],
      });
    },
  });

  const deleteSampleMutation = useMutation({
    mutationFn: (sampleId: string) => removeSellerApplicationSample(sampleId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["mySellerApplicationSamples", applicationId],
      });
    },
  });

  const submitApplicationMutation = useMutation({
    mutationFn: () => {
      if (!user?.id) throw new Error("You must be signed in.");
      if (!applicationId) throw new Error("Create an application draft first.");

      const videoCount = samples.filter(
        (sample) => sample.sample_type === "video"
      ).length;

      return submitSellerApplication(
        user.id,
        applicationId,
        samples.length,
        videoCount
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["mySellerApplication", user?.id ?? null],
      });

      setOkMsg("Creator application submitted for review.");
      setErrMsg(null);
    },
  });

  const saveMostRecentUploadMutation = useMutation({
    mutationFn: (input: {
      applicationId: string;
      sampleId?: string;
      url: string;
      sortOrder: number;
    }) => saveRequiredRecentUploadSample(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["mySellerApplicationSamples", applicationId],
      });
    },
  });

  const sampleCount = samples.length;

  const videoCount = useMemo(
    () => samples.filter((sample) => sample.sample_type === "video").length,
    [samples]
  );

  const hasMinimumSamples = sampleCount >= 3;
  const hasReachedMaxSamples = sampleCount >= 10;

  const isApplicationLocked = useMemo(
    () =>
      !sellerApplication ||
        !canEditApplication
        ? sellerApplication?.status === "submitted" ||
        sellerApplication?.status === "under_review" ||
        sellerApplication?.status === "approved" ||
        sellerApplication?.status === "rejected" ||
        sellerApplication?.status === "suspended"
        : false,
    [sellerApplication, canEditApplication]
  );

  const combinedErrorText = useMemo(() => {
    const messages = [
      sellerAccessError ? getErrorMessage(sellerAccessError) : null,
      samplesError ? getErrorMessage(samplesError) : null,
    ].filter(Boolean);

    return messages.length ? messages.join(" ") : null;
  }, [sellerAccessError, samplesError]);

  const mostRecentUploadSample = useMemo(
    () => samples.find(isRequiredRecentUploadSample) ?? null,
    [samples]
  );

  const sampleUrlError = useMemo(() => getUrlValidationError(url), [url]);

  const mostRecentUploadUrlError = useMemo(
    () => getUrlValidationError(mostRecentUploadUrl),
    [mostRecentUploadUrl]
  );

  const hasMostRecentUploadSample = Boolean(
    mostRecentUploadSample?.url?.trim()
  );

  useEffect(() => {
    setMostRecentUploadUrl(mostRecentUploadSample?.url ?? "");
  }, [mostRecentUploadSample]);

  const onStartDraft = async () => {
    setOkMsg(null);
    setErrMsg(null);

    if (!canStartApplication) {
      setErrMsg(
        "Add a display name and handle in Profile Settings before starting your application."
      );
      return;
    }

    try {
      await createDraftMutation.mutateAsync({
        status: "draft",
      });

      setOkMsg("Creator application draft created.");
    } catch (error) {
      setErrMsg(getErrorMessage(error));
    }
  };

  const onAddLinkSample = async () => {
    setOkMsg(null);
    setErrMsg(null);

    const nextTitle = title.trim();
    const nextDescription = description.trim();
    const nextUrl = normaliseUrlInput(url);

    if (!applicationId) {
      setErrMsg("Create an application draft before adding work samples.");
      return;
    }

    if (!canEditApplication) {
      setErrMsg("This application can no longer be edited.");
      return;
    }

    if (hasReachedMaxSamples) {
      setErrMsg("You can add a maximum of 10 work samples.");
      return;
    }

    if (!nextTitle) {
      setErrMsg("Add a sample title.");
      return;
    }

    if (!nextUrl || !isValidUrl(nextUrl)) {
      setErrMsg(
        "Add a valid public URL. CreatorHub can add https:// automatically when it is missing."
      );
      return;
    }

    try {
      await addLinkSampleMutation.mutateAsync({
        applicationId,
        title: nextTitle,
        description: nextDescription,
        url: nextUrl,
        sortOrder: sampleCount,
      });

      setTitle("");
      setDescription("");
      setUrl("");
      setOkMsg("Work sample added.");
    } catch (error) {
      setErrMsg(getErrorMessage(error));
    }
  };

  const onSaveMostRecentUpload = async () => {
    setOkMsg(null);
    setErrMsg(null);

    const nextUrl = normaliseUrlInput(mostRecentUploadUrl);

    if (!applicationId) {
      setErrMsg("Create an application draft before adding required links.");
      return;
    }

    if (!canEditApplication) {
      setErrMsg("This application can no longer be edited.");
      return;
    }

    if (!mostRecentUploadSample && hasReachedMaxSamples) {
      setErrMsg("You can add a maximum of 10 work samples.");
      return;
    }

    if (!nextUrl || !isValidUrl(nextUrl)) {
      setErrMsg(
        "Add a valid public URL for your most recent upload or VOD. CreatorHub can add https:// automatically when it is missing."
      );
      return;
    }

    try {
      await saveMostRecentUploadMutation.mutateAsync({
        applicationId,
        sampleId: mostRecentUploadSample?.id,
        url: nextUrl,
        sortOrder: sampleCount,
      });

      setMostRecentUploadUrl(nextUrl);
      setOkMsg("Most Recent Upload/Vod link saved.");
    } catch (error) {
      setErrMsg(getErrorMessage(error));
    }
  };

  const onDeleteSample = async (sampleId: string) => {
    setOkMsg(null);
    setErrMsg(null);

    try {
      await deleteSampleMutation.mutateAsync(sampleId);
      setOkMsg("Work sample removed.");
    } catch (error) {
      setErrMsg(getErrorMessage(error));
    }
  };

  const onSubmitForReview = async () => {
    setOkMsg(null);
    setErrMsg(null);

    if (!canSubmitApplication) {
      setErrMsg(
        "Complete your profile basics and link at least one creator platform before submitting."
      );
      return;
    }

    if (!hasMinimumSamples) {
      setErrMsg("Add at least 3 work samples before submitting.");
      return;
    }

    if (!hasMostRecentUploadSample) {
      setErrMsg("Add your Most Recent Upload/Vod link before submitting.");
      return;
    }

    try {
      await submitApplicationMutation.mutateAsync();
    } catch (error) {
      setErrMsg(getErrorMessage(error));
    }
  };

  if (!loading && !user) {
    return (
      <div className={classes.page}>
        <div className={classes.card}>
          <div className={classes.cardTitle}>You’re not signed in</div>

          <p className={classes.cardText}>
            Sign in to start or manage your Creator application.
          </p>

          <div className={classes.row}>
            <Link className={classes.btnPrimary} to="/signin">
              Sign in
            </Link>

            <Link className={classes.btnOutline} to="/">
              Back home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={classes.page}>
      <div className={classes.header}>
        <h1 className={classes.h1}>Apply as a creator</h1>

        <p className={classes.sub}>
          Creator access is reviewed manually. Add clear work samples and keep
          your public profile trustworthy.
        </p>
      </div>

      {infoMsg && (
        <div className={classes.bannerInfo}>
          <div className={classes.bannerTitle}>Application guidance</div>
          <div className={classes.bannerText}>{infoMsg}</div>
        </div>
      )}

      {okMsg && (
        <div className={classes.bannerOk}>
          <div className={classes.bannerTitle}>Success</div>
          <div className={classes.bannerText}>{okMsg}</div>
        </div>
      )}

      {(errMsg || combinedErrorText) && (
        <div className={classes.bannerErr}>
          <div className={classes.bannerTitle}>Action needed</div>
          <div className={classes.bannerText}>{errMsg ?? combinedErrorText}</div>
        </div>
      )}

      <div className={classes.card}>
        <div className={classes.cardTitle}>Before you apply</div>

        <p className={classes.cardText}>
          These checks help keep CreatorHub higher trust and easier to review.
        </p>

        <div className={classes.statusGrid}>
          <div className={classes.statusCard}>
            <div className={classes.statusLabel}>Profile basics</div>
            <div className={classes.statusValue}>
              {profileReady ? "Ready" : "Needs update"}
            </div>
            <div className={classes.statusHelp}>
              Handle and display name are required.
            </div>
          </div>

          <div className={classes.statusCard}>
            <div className={classes.statusLabel}>Linked platform</div>
            <div className={classes.statusValue}>
              {hasLinkedCreatorPlatform ? "Ready" : "Not linked yet"}
            </div>
            <div className={classes.statusHelp}>
              Link Twitch or YouTube before submission.
            </div>
          </div>


          <div className={classes.statusCard}>
            <div className={classes.statusLabel}>Current status</div>
            <div className={classes.statusValue}>{creatorStatusLabel}</div>
            <div className={classes.statusHelp}>
              Only draft and needs-changes applications can be edited.
            </div>
          </div>
        </div>

        <div className={classes.checklist}>
          <div className={classes.checklistItem}>
            <span
              className={
                profileReady ? classes.checklistOkDot : classes.checklistDot
              }
            />
            <span>Set your handle and display name in Profile Settings</span>
          </div>

          <div className={classes.checklistItem}>
            <span
              className={
                hasLinkedCreatorPlatform
                  ? classes.checklistOkDot
                  : classes.checklistDot
              }
            />
            <span>Link at least one creator platform</span>
          </div>

          <div className={classes.checklistItem}>
            <span
              className={
                hasMostRecentUploadSample
                  ? classes.checklistOkDot
                  : classes.checklistDot
              }
            />
            <span>Add your Most Recent Upload/Vod link</span>
          </div>

          <div className={classes.checklistItem}>
            <span
              className={
                hasMinimumSamples ? classes.checklistOkDot : classes.checklistDot
              }
            />
            <span>Add at least 3 work samples</span>
          </div>
        </div>

        <div className={classes.row}>
          <Link className={classes.btnOutline} to="/settings/profile">
            Go to profile settings
          </Link>

          {!sellerApplication && (
            <button
              className={classes.btnPrimary}
              type="button"
              onClick={onStartDraft}
              disabled={createDraftMutation.isPending || !canStartApplication}
            >
              {createDraftMutation.isPending
                ? "Starting…"
                : "Start Creator application"}
            </button>
          )}
        </div>
      </div>

      <div className={classes.card}>
        <div className={classes.cardTitle}>Application status</div>

        <p className={classes.cardText}>
          Review state controls creator access across the app.
        </p>

        <div className={classes.chips}>
          <span className={classes.chip}>{creatorStatusLabel}</span>
          <span className={classes.chipMuted}>Manual review</span>
          <span className={classes.chipMuted}>No instant activation</span>
        </div>

        {sellerApplication?.reviewer_notes && (
          <>
            <div className={classes.divider} />
            <div className={classes.field}>
              <div className={classes.label}>Reviewer notes</div>
              <div className={classes.cardText}>{sellerApplication.reviewer_notes}</div>
            </div>
          </>
        )}

        {sellerApplication?.rejection_reason && (
          <div className={classes.field}>
            <div className={classes.label}>Rejection reason</div>
            <div className={classes.cardText}>
              {sellerApplication.rejection_reason}
            </div>
          </div>
        )}
      </div>

      <div className={classes.card}>
        <div className={classes.cardTitle}>Work samples</div>

        <p className={classes.cardText}>
          Links are preferred right now. Uploaded image and video samples can be
          enabled once media storage is ready.
        </p>

        <div className={classes.samplesHeader}>
          <div>
            <div className={classes.sampleCount}>
              {sampleCount} / 10 samples added
            </div>
            <div className={classes.sampleHelp}>
              Minimum 3 required before submission.
            </div>
          </div>

          <div className={classes.chips}>
            <span className={classes.chip}>Link ready</span>
            <span className={classes.chipMuted}>Image upload soon</span>
            <span className={classes.chipMuted}>Video upload soon</span>
          </div>
        </div>

        {applicationId && canEditApplication && !isApplicationLocked && (
          <div className={classes.formGrid}>
            <div className={classes.field}>
              <div className={classes.label}>Most Recent Upload/Vod</div>

              <input
                className={classes.input}
                value={mostRecentUploadUrl}
                onChange={(event) => setMostRecentUploadUrl(event.currentTarget.value)}
                onBlur={() =>
                  setMostRecentUploadUrl((currentValue) => getDisplayUrl(currentValue))
                }
                placeholder="https://..."
              />

              <div className={classes.fieldHelp}>
                Required. Add a public link to your most recent Twitch VOD, YouTube upload,
                or other recent creator work. This counts toward your 3 minimum samples.
              </div>

              {mostRecentUploadUrlError && (
                <div className={classes.fieldHelp}>{mostRecentUploadUrlError}</div>
              )}

              {!mostRecentUploadUrlError && mostRecentUploadUrl.trim() && (
                <div className={classes.fieldHelp}>
                  Saved as: {getDisplayUrl(mostRecentUploadUrl)}
                </div>
              )}
            </div>

            <div className={classes.row}>
              <button
                className={classes.btnPrimary}
                type="button"
                onClick={onSaveMostRecentUpload}
                disabled={
                  saveMostRecentUploadMutation.isPending ||
                  !canEditApplication ||
                  Boolean(mostRecentUploadUrlError) ||
                  (!mostRecentUploadSample && hasReachedMaxSamples)
                }
              >
                {saveMostRecentUploadMutation.isPending
                  ? "Saving…"
                  : mostRecentUploadSample
                    ? "Update required link"
                    : "Save required link"}
              </button>
            </div>
          </div>
        )}

        {applicationId && canEditApplication && !isApplicationLocked && (
          <div className={classes.formGrid}>
            <div className={classes.field}>
              <div className={classes.label}>Sample title</div>

              <input
                className={classes.input}
                value={title}
                onChange={(event) => setTitle(event.currentTarget.value)}
                placeholder="YouTube thumbnail pack, VOD editor reel, emote portfolio..."
              />
            </div>

            <div className={classes.field}>
              <div className={classes.label}>Sample link</div>

              <input
                className={classes.input}
                value={url}
                onChange={(event) => setUrl(event.currentTarget.value)}
                onBlur={() => setUrl((currentValue) => getDisplayUrl(currentValue))}
                placeholder="https://..."
              />

              <div className={classes.fieldHelp}>
                Use a public portfolio, drive folder, website, or direct showcase link.
              </div>

              {sampleUrlError && (
                <div className={classes.fieldHelp}>{sampleUrlError}</div>
              )}

              {!sampleUrlError && url.trim() && (
                <div className={classes.fieldHelp}>
                  Saved as: {getDisplayUrl(url)}
                </div>
              )}
            </div>

            <div className={classes.field}>
              <div className={classes.label}>Short description</div>

              <textarea
                className={classes.textarea}
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.currentTarget.value)}
                placeholder="Explain what the sample shows, your role in it, and any useful context."
              />
            </div>

            <div className={classes.row}>
              <button
                className={classes.btnPrimary}
                type="button"
                onClick={onAddLinkSample}
                disabled={
                  addLinkSampleMutation.isPending ||
                  hasReachedMaxSamples ||
                  !canEditApplication ||
                  Boolean(sampleUrlError)
                }
              >
                {addLinkSampleMutation.isPending ? "Adding…" : "Add link sample"}
              </button>
            </div>
          </div>
        )}

        {sellerApplication && !canEditApplication && (
          <div className={classes.fieldHelp}>
            This application is currently locked while it is being reviewed or
            after a final decision.
          </div>
        )}

        {!sellerApplication && (
          <div className={classes.fieldHelp}>
            Start your Creator application draft before adding samples.
          </div>
        )}

        <div className={classes.sampleList}>
          {samples.map((sample) => (
            <div key={sample.id} className={classes.sampleCard}>
              <div className={classes.sampleTopRow}>
                <div>
                  <div className={classes.sampleTitle}>{sample.title}</div>
                  <div className={classes.sampleMeta}>
                    {isRequiredRecentUploadSample(sample)
                      ? "Required link sample"
                      : `${sample.sample_type} sample`}
                  </div>
                </div>

                {canEditApplication && !isRequiredRecentUploadSample(sample) && (
                  <button
                    className={classes.btnDanger}
                    type="button"
                    onClick={() => onDeleteSample(sample.id)}
                    disabled={deleteSampleMutation.isPending}
                  >
                    Remove
                  </button>
                )}
              </div>

              {sample.description && (
                <div className={classes.sampleDescription}>{sample.description}</div>
              )}

              {sample.url && (
                <a
                  href={sample.url}
                  target="_blank"
                  rel="noreferrer"
                  className={classes.sampleLink}
                >
                  Open sample
                </a>
              )}
            </div>
          ))}
        </div>

        {!isSamplesLoading && sampleCount === 0 && applicationId && (
          <div className={classes.fieldHelp}>
            No samples added yet. Add at least 3 before submitting.
          </div>
        )}
      </div>

      <div className={classes.card}>
        <div className={classes.cardTitle}>Submit for review</div>

        <p className={classes.cardText}>
          Once submitted, your application should no longer be editable until it
          is returned for changes.
        </p>

        <div className={classes.checklist}>
          <div className={classes.checklistItem}>
            <span
              className={
                profileReady ? classes.checklistOkDot : classes.checklistDot
              }
            />
            <span>Profile basics complete</span>
          </div>

          <div className={classes.checklistItem}>
            <span
              className={
                hasLinkedCreatorPlatform
                  ? classes.checklistOkDot
                  : classes.checklistDot
              }
            />
            <span>At least one creator platform linked</span>
          </div>

          <div className={classes.checklistItem}>
            <span
              className={
                hasMostRecentUploadSample
                  ? classes.checklistOkDot
                  : classes.checklistDot
              }
            />
            <span>Most Recent Upload/Vod link added</span>
          </div>

          <div className={classes.checklistItem}>
            <span
              className={
                hasMinimumSamples ? classes.checklistOkDot : classes.checklistDot
              }
            />
            <span>At least 3 work samples added</span>
          </div>

          <div className={classes.checklistItem}>
            <span
              className={
                videoCount <= 1 ? classes.checklistOkDot : classes.checklistDot
              }
            />
            <span>No more than 1 video sample</span>
          </div>
        </div>

        <div className={classes.row}>
          <button
            className={classes.btnPrimary}
            type="button"
            onClick={onSubmitForReview}
            disabled={
              submitApplicationMutation.isPending ||
              !canSubmitApplication ||
              !hasMinimumSamples ||
              !hasMostRecentUploadSample ||
              sampleCount > 10 ||
              videoCount > 1 ||
              !applicationId
            }
          >
            {submitApplicationMutation.isPending
              ? "Submitting…"
              : sellerApplication?.status === "needs_changes"
                ? "Re-submit for review"
                : "Submit for review"}
          </button>

          <Link className={classes.btnOutline} to="/settings/profile">
            Back to profile settings
          </Link>
        </div>
      </div>

      {(loading || isAccessLoading || isSamplesLoading) && (
        <div className={classes.loadingText}>Loading…</div>
      )}
    </div>
  );
};

export default ApplyCreator;