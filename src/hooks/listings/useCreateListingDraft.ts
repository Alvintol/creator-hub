import { useMutation } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";

type ListingPriceType = "fixed" | "starting_at" | "range";
type ListingOfferingType = "digital" | "commission" | "service";
type ListingVideoSubtype = "long-form" | "short-form" | null;

export type CreateListingDraftInput = {
  title: string;
  short: string;
  offering_type: ListingOfferingType;
  category: string;
  video_subtype: ListingVideoSubtype;
  price_type: ListingPriceType;
  price_min: number;
  price_max: number | null;
  deliverables: string[];
  tags: string[];
  preview_url: string | null;
};

const cleanList = (items: string[]) =>
  items
    .map((item) => item.trim())
    .filter(Boolean);

export const useCreateListingDraft = () => {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateListingDraftInput) => {
      if (!user?.id) {
        throw new Error("You must be signed in to create a listing.");
      }

      const deliverables = cleanList(input.deliverables);
      const tags = cleanList(input.tags);

      const payload = {
        user_id: user.id,
        title: input.title.trim(),
        short: input.short.trim(),
        offering_type: input.offering_type,
        category: input.category.trim(),
        video_subtype: input.video_subtype,
        price_type: input.price_type,
        price_min: input.price_min,
        price_max: input.price_max,
        deliverables,
        tags,
        preview_url: input.preview_url?.trim() || null,
        status: "draft" as const,
        is_active: false,
      };

      const { data, error } = await supabase
        .from("listings")
        .insert(payload)
        .select(`
          id,
          user_id,
          title,
          short,
          offering_type,
          category,
          video_subtype,
          price_type,
          price_min,
          price_max,
          deliverables,
          tags,
          preview_url,
          status,
          is_active
        `)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Listing draft could not be created.");

      return data;
    },
  });
};