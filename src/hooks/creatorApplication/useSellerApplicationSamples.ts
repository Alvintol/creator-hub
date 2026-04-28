import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import type { SellerApplicationSampleType } from "../../domain/sellerApplication";

export type SellerApplicationSampleRow = {
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

async function fetchSellerApplicationSamples(
  applicationId: string
): Promise<SellerApplicationSampleRow[]> {
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
}

export const useSellerApplicationSamples = (applicationId: string | null) =>
  useQuery<SellerApplicationSampleRow[]>({
    queryKey: ["sellerApplicationSamples", applicationId],
    enabled: Boolean(applicationId),
    queryFn: () =>
      applicationId
        ? fetchSellerApplicationSamples(applicationId)
        : Promise.resolve([]),
    staleTime: 10_000,
  });