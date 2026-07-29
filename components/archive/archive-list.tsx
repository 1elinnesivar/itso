"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fetchAllRecords } from "@/lib/records";
import { createClient } from "@/lib/supabase/client";

export function ArchiveList() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["archive"], queryFn: () => fetchAllRecords(true) });

  async function restore(id: string) {
    const { error } = await createClient().rpc("restore_record", { p_id: id });
    if (error) {
      toast.error("Kayıt geri alınamadı.");
      return;
    }
    toast.success("Kayıt geri alındı.");
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["archive"] }),
      queryClient.invalidateQueries({ queryKey: ["records"] }),
    ]);
  }

  if (query.isLoading) {
    return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Arşiv yükleniyor...</div>;
  }
  if (query.error) return <p className="text-destructive">Arşiv yüklenemedi.</p>;

  return (
    <div className="overflow-x-auto rounded-lg border bg-background">
      <table className="w-full min-w-[800px] text-sm">
        <thead className="bg-muted text-left">
          <tr>
            <th className="p-3">Sıra</th>
            <th className="p-3">Üye Sicil No</th>
            <th className="p-3">Unvan</th>
            <th className="p-3">Silinme zamanı</th>
            <th className="p-3">İşlem</th>
          </tr>
        </thead>
        <tbody>
          {(query.data ?? []).map((record) => (
            <tr key={record.id} className="border-t">
              <td className="p-3">{record.display_order}</td>
              <td className="p-3">{record.member_registry_no}</td>
              <td className="p-3 font-medium">{record.title}</td>
              <td className="p-3">
                {record.deleted_at
                  ? new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(record.deleted_at))
                  : "—"}
              </td>
              <td className="p-3">
                <Button size="sm" variant="outline" onClick={() => void restore(record.id)}>
                  <RotateCcw className="h-4 w-4" /> Geri al
                </Button>
              </td>
            </tr>
          ))}
          {!query.data?.length && (
            <tr><td colSpan={5} className="p-10 text-center text-muted-foreground">Arşivde kayıt yok.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

