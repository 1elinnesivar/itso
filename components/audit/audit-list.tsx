"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import type { AuditLog } from "@/types/app";

const actionNames = {
  insert: "Ekleme",
  update: "Güncelleme",
  delete: "Silme",
  restore: "Geri alma",
  import: "İçe aktarma",
};

export function AuditList() {
  const query = useQuery({
    queryKey: ["audit"],
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("audit_logs")
        .select("id, record_id, action, old_data, new_data, changed_fields, actor_id, version_from, version_to, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as AuditLog[];
    },
  });

  if (query.isLoading) {
    return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Denetim kayıtları yükleniyor...</div>;
  }
  if (query.error) return <p className="text-destructive">Denetim kayıtları yüklenemedi.</p>;

  return (
    <div className="overflow-x-auto rounded-lg border bg-background">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="bg-muted text-left">
          <tr>
            <th className="p-3">Zaman</th>
            <th className="p-3">İşlem</th>
            <th className="p-3">Kayıt</th>
            <th className="p-3">Değişen alanlar</th>
            <th className="p-3">Sürüm</th>
            <th className="p-3">Kullanıcı</th>
          </tr>
        </thead>
        <tbody>
          {(query.data ?? []).map((log) => (
            <tr key={log.id} className="border-t align-top">
              <td className="whitespace-nowrap p-3">
                {new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(log.created_at))}
              </td>
              <td className="p-3"><Badge variant={log.action === "delete" ? "destructive" : "secondary"}>{actionNames[log.action]}</Badge></td>
              <td className="p-3 font-mono text-xs">{log.record_id}</td>
              <td className="p-3">{log.changed_fields.join(", ") || "—"}</td>
              <td className="p-3">{log.version_from ?? "—"} → {log.version_to ?? "—"}</td>
              <td className="p-3 font-mono text-xs">{log.actor_id ?? "Sistem"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

