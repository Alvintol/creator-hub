import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";

export type CreatorApplicationQueueState = {
  openCount: number;
  maxOpen: number;
  remaining: number;
  hasCapacity: boolean;
  isFull: boolean;
};

const fetchCreatorApplicationQueueState =
  async (): Promise<CreatorApplicationQueueState> => {
    const { data, error } = await supabase.rpc(
      "get_creator_application_queue_state"
    );

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;

    const openCount = Number(row?.open_count ?? 0);
    const maxOpen = Number(row?.max_open ?? 10);
    const remaining = Number(row?.remaining ?? Math.max(maxOpen - openCount, 0));
    const hasCapacity = Boolean(row?.has_capacity ?? openCount < maxOpen);

    return {
      openCount,
      maxOpen,
      remaining,
      hasCapacity,
      isFull: !hasCapacity,
    };
  };

export const useCreatorApplicationQueueState = () => {
  const { user, loading } = useAuth();

  return useQuery<CreatorApplicationQueueState>({
    queryKey: ["creatorApplicationQueueState"],
    enabled: !loading && Boolean(user?.id),
    staleTime: 15_000,
    queryFn: fetchCreatorApplicationQueueState,
  });
};