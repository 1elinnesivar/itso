"use client";

import { useQuery } from "@tanstack/react-query";
import { DatabaseBackup, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { RecordsTable } from "@/components/records/records-table";
import {
  contactsFromLegacyRecords,
  fetchLegacyRecords,
  fetchLegacySnapshots,
} from "@/lib/legacy-table";

export function LegacyTableView() {
  const snapshots = useQuery({
    queryKey: ["legacy-table", "snapshots"],
    queryFn: fetchLegacySnapshots,
  });
  const [snapshotId, setSnapshotId] = useState("");

  useEffect(() => {
    if (!snapshotId && snapshots.data?.[0]) {
      setSnapshotId(snapshots.data[0].id);
    }
  }, [snapshotId, snapshots.data]);

  const records = useQuery({
    queryKey: ["legacy-table", "records", snapshotId],
    queryFn: () => fetchLegacyRecords(snapshotId),
    enabled: Boolean(snapshotId),
  });
  const contacts = useMemo(
    () => contactsFromLegacyRecords(records.data ?? []),
    [records.data],
  );

  if (snapshots.isLoading) {
    return <p className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Eski tablo yükleniyor…</p>;
  }
  if (snapshots.error) return <p className="text-destructive">Eski tablo yüklenemedi.</p>;
  if (!snapshots.data?.length) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
        <DatabaseBackup className="mx-auto mb-3 h-9 w-9" />
        Henüz eski tablo anlık görüntüsü oluşturulmadı.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-background p-3">
        <label className="text-sm font-medium" htmlFor="legacy-snapshot">Kayıt tarihi</label>
        <select
          id="legacy-snapshot"
          className="h-10 min-w-72 rounded-md border bg-background px-3 text-sm"
          value={snapshotId}
          onChange={(event) => setSnapshotId(event.target.value)}
        >
          {snapshots.data.map((snapshot) => (
            <option key={snapshot.id} value={snapshot.id}>
              {new Intl.DateTimeFormat("tr-TR", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(snapshot.created_at))} · {snapshot.record_count} kayıt
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">
          Salt okunur; kaynak dosya veritabanında saklanmaz.
        </span>
      </div>
      {records.isLoading ? (
        <p className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Kayıtlar yükleniyor…</p>
      ) : records.error ? (
        <p className="text-destructive">Eski tablo kayıtları yüklenemedi.</p>
      ) : (
        <RecordsTable
          records={records.data ?? []}
          contacts={contacts}
          role="viewer"
          canExport
          loading={records.isFetching}
          onRefresh={() => void records.refetch()}
        />
      )}
    </div>
  );
}
