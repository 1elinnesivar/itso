"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAllRecords, fetchContacts, fetchProfile } from "@/lib/records";
import { subscribeToRecordChanges } from "@/lib/nhost/realtime";

export function useRecords() {
  const queryClient = useQueryClient();
  const records = useQuery({ queryKey: ["records"], queryFn: () => fetchAllRecords(false), refetchInterval: 5_000 });
  const contacts = useQuery({ queryKey: ["contacts"], queryFn: fetchContacts, refetchInterval: 5_000 });
  const profile = useQuery({ queryKey: ["profile"], queryFn: fetchProfile });

  useEffect(() => {
    const refreshRecords = () => {
      void queryClient.invalidateQueries({ queryKey: ["records"] });
      void queryClient.invalidateQueries({ queryKey: ["contacts"] });
    };
    const unsubscribe = subscribeToRecordChanges(refreshRecords);

    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshRecords();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      unsubscribe();
    };
  }, [queryClient]);

  return { records, contacts, profile };
}
