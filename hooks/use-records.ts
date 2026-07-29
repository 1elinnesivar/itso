"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { fetchAllRecords, fetchContacts, fetchProfile } from "@/lib/records";

export function useRecords() {
  const queryClient = useQueryClient();
  const records = useQuery({ queryKey: ["records"], queryFn: () => fetchAllRecords(false) });
  const contacts = useQuery({ queryKey: ["contacts"], queryFn: fetchContacts });
  const profile = useQuery({ queryKey: ["profile"], queryFn: fetchProfile });

  useEffect(() => {
    const supabase = createClient();
    const refreshRecords = () => {
      void queryClient.invalidateQueries({ queryKey: ["records"] });
    };
    const channel = supabase
      .channel("records-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "records" }, refreshRecords)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "record_contacts" },
        refreshRecords,
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "contact_people" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["contacts"] });
        refreshRecords();
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") refreshRecords();
      });

    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshRecords();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return { records, contacts, profile };
}

