"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { RecordsTable } from "@/components/records/records-table";
import { Button } from "@/components/ui/button";
import { useRecords } from "@/hooks/use-records";

export default function RecordsPage() {
  const { records, contacts, profile } = useRecords();
  const loading = records.isLoading || contacts.isLoading || profile.isLoading;

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Kayıtlar yükleniyor...
      </div>
    );
  }
  if (records.error || contacts.error || profile.error) {
    return (
      <div className="mx-auto mt-20 max-w-lg rounded-lg border p-8 text-center">
        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-destructive" />
        <h1 className="font-semibold">Veriler yüklenemedi</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Supabase bağlantısını ve kullanıcı yetkilerini kontrol edin.
        </p>
        <Button className="mt-5" onClick={() => records.refetch()}>Yeniden dene</Button>
      </div>
    );
  }

  return (
    <section>
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Mobilya kayıtları</h1>
        <p className="text-sm text-muted-foreground">
          Kayıtları arayın, filtreleyin ve yetkinize göre yönetin.
        </p>
      </div>
      <RecordsTable
        records={records.data ?? []}
        contacts={contacts.data ?? []}
        role={profile.data!.role}
        canExport={profile.data!.id !== "anonymous"}
        loading={records.isFetching}
        onRefresh={() => void records.refetch()}
      />
    </section>
  );
}
