"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, DatabaseBackup, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  parseCurrentRosterWorkbook,
  type CurrentRosterRow,
} from "@/lib/excel/current-roster";
import { fetchAllRecords } from "@/lib/records";
import { fetchLegacyRecords, fetchLegacySnapshots } from "@/lib/legacy-table";
import { createClient } from "@/lib/nhost/client";

export function CurrentRosterPanel() {
  const queryClient = useQueryClient();
  const [archiving, setArchiving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<CurrentRosterRow[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [missingCount, setMissingCount] = useState(0);
  const [legacySnapshotId, setLegacySnapshotId] = useState("");
  const [legacyRecordCount, setLegacyRecordCount] = useState(0);
  const [importFromLegacy, setImportFromLegacy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  const invalidCount = useMemo(
    () => rows.filter((row) => row.validation_errors.length > 0).length,
    [rows],
  );
  const selectedMembers = useMemo(
    () => new Set(rows.map((row) => row.member_registry_no)),
    [rows],
  );
  const removedCount = Math.max(
    (importFromLegacy ? legacyRecordCount : activeCount) - selectedMembers.size,
    0,
  );
  const canApply = rows.length > 0 && invalidCount === 0 && missingCount === 0;

  async function archiveCurrentTable() {
    const confirmed = window.confirm(
      "Mevcut ana tablonun tam kopyası Eski Tablo'ya alınacak ve ana tablo boşaltılacak. " +
        "Kayıtlar fiziksel olarak silinmeyecek. Devam edilsin mi?",
    );
    if (!confirmed) return;

    setArchiving(true);
    const { data, error } = await createClient().rpc("archive_current_table");
    setArchiving(false);
    if (error) {
      toast.error(`Ana tablo eskiye taşınamadı: ${error.message}`, {
        duration: 15_000,
      });
      return;
    }

    const result = data as { snapshot_count?: number } | null;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["records"] }),
      queryClient.invalidateQueries({ queryKey: ["legacy-table"] }),
      queryClient.invalidateQueries({ queryKey: ["archive"] }),
    ]);
    setActiveCount(0);
    toast.success(
      `${result?.snapshot_count ?? 0} kayıt Eski Tablo'ya alındı; ana tablo boşaltıldı.`,
      { duration: 10_000 },
    );
  }

  async function clearCurrentTable() {
    const confirmation = window.prompt(
      "Ana tablo Eski Tablo'ya yeni kopya oluşturulmadan boşaltılacak. Onaylamak için TEMİZLE yazın.",
    );
    if (confirmation !== "TEMİZLE") return;

    setClearing(true);
    const { data, error } = await createClient().rpc(
      "clear_current_table_without_snapshot",
    );
    setClearing(false);
    if (error) {
      toast.error(`Ana tablo temizlenemedi: ${error.message}`, {
        duration: 15_000,
      });
      return;
    }

    const result = data as { deleted_count?: number } | null;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["records"] }),
      queryClient.invalidateQueries({ queryKey: ["archive"] }),
    ]);
    setActiveCount(0);
    toast.success(
      `${result?.deleted_count ?? 0} ana tablo kaydı tamamen silindi. Eski Tablo değiştirilmedi.`,
      { duration: 10_000 },
    );
  }

  async function selectFile(file: File | undefined) {
    if (!file) return;
    setLoading(true);
    setRows([]);
    setFileName(file.name);
    try {
      const [parsed, active, archived] = await Promise.all([
        parseCurrentRosterWorkbook(file),
        fetchAllRecords(false),
        fetchAllRecords(true),
      ]);
      let sourceRecords = [...active, ...archived];
      let sourceSnapshotId = "";
      const useLegacy = sourceRecords.length === 0;
      if (useLegacy) {
        const snapshots = await fetchLegacySnapshots();
        sourceSnapshotId = snapshots[0]?.id ?? "";
        sourceRecords = sourceSnapshotId
          ? await fetchLegacyRecords(sourceSnapshotId)
          : [];
      }
      const knownMembers = new Set(sourceRecords.map((record) => record.member_registry_no));
      setRows(parsed);
      setActiveCount(active.length);
      setImportFromLegacy(useLegacy);
      setLegacySnapshotId(sourceSnapshotId);
      setLegacyRecordCount(sourceRecords.length);
      setMissingCount(
        parsed.filter((row) => !knownMembers.has(row.member_registry_no)).length,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Güncel liste okunamadı.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function applyRoster() {
    if (!canApply) return;
    const confirmationText = activeCount > 0
      ? `Bu işlem önce ${activeCount} aktif kaydın tam yedeğini Eski Tablo'ya alacak, ` +
        `sonra ana tabloyu ${rows.length} firmalık güncel listeye çevirecek. ` +
        `${removedCount} firma yalnız Eski Tablo'da kalacak. Devam edilsin mi?`
      : `Boş ana tabloya ${rows.length} güncel firma getirilecek. ` +
        "Eski Tablo'daki yedek değiştirilmeyecek. Devam edilsin mi?";
    const confirmed = window.confirm(confirmationText);
    if (!confirmed) return;

    setApplying(true);
    const payload = rows.map(({ validation_errors: _errors, row_number: _row, ...row }) => row);
    const { data, error } = importFromLegacy
      ? await createClient().rpc("apply_current_roster_from_legacy", {
          p_snapshot_id: legacySnapshotId,
          p_source_file_name: fileName,
          p_rows: payload,
        })
      : await createClient().rpc("apply_current_roster", {
          p_source_file_name: fileName,
          p_rows: payload,
        });
    setApplying(false);
    if (error) {
      toast.error(`Güncel liste uygulanamadı: ${error.message}`, {
        duration: 15_000,
      });
      return;
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["records"] }),
      queryClient.invalidateQueries({ queryKey: ["legacy-table"] }),
      queryClient.invalidateQueries({ queryKey: ["archive"] }),
    ]);
    const result = data as { current_count?: number; snapshot_count?: number } | null;
    toast.success(
      activeCount > 0
        ? `${result?.snapshot_count ?? activeCount} kayıt Eski Tablo'ya alındı; ` +
          `${result?.current_count ?? rows.length} güncel firma ana tabloya uygulandı.`
        : `${result?.current_count ?? rows.length} güncel firma ana tabloya uygulandı; Eski Tablo korundu.`,
      { duration: 10_000 },
    );
    setRows([]);
    setFileName("");
  }

  return (
    <section className="space-y-5 rounded-lg border border-amber-300 bg-amber-50/40 p-5">
      <div className="flex items-start gap-3">
        <DatabaseBackup className="mt-0.5 h-6 w-6 shrink-0 text-amber-700" />
        <div>
          <h2 className="font-semibold">Güncel firma listesine güvenli geçiş</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Önce canlı tablonun tam kopyasını Eski Tablo’ya alır. Güncel listedeki
            firmalarda renk, not, telefon, temas, hediye ve İTSO bilgileri korunur.
          </p>
        </div>
      </div>
      <div className="space-y-2 rounded-lg border bg-background p-4">
        <h3 className="font-medium">1. Mevcut tabloyu eskiye taşı</h3>
        <p className="text-sm text-muted-foreground">
          Tüm mevcut alanları ve temasları Eski Tablo’ya kopyalar; ana listeyi
          fiziksel veri silmeden boş hale getirir.
        </p>
        <Button
          variant="outline"
          disabled={archiving || applying || loading}
          onClick={() => void archiveCurrentTable()}
        >
          {archiving ? <Loader2 className="h-4 w-4 animate-spin" /> : <DatabaseBackup className="h-4 w-4" />}
          Eski tabloya taşı ve ana tabloyu boşalt
        </Button>
      </div>
      <div className="space-y-2 rounded-lg border border-red-300 bg-red-50/50 p-4">
        <h3 className="font-medium text-red-900">Ana tabloyu yedeklemeden temizle</h3>
        <p className="text-sm text-red-800">
          Eski Tablo’ya yeni kopya oluşturmaz. Ana kayıtları ve ana arşivi
          fiziksel olarak siler; mevcut Eski Tablo kopyasına dokunmaz.
        </p>
        <Button
          variant="destructive"
          disabled={clearing || archiving || applying || loading}
          onClick={() => void clearCurrentTable()}
        >
          {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
          Ana tabloyu temizle
        </Button>
      </div>
      <div className="space-y-3 rounded-lg border bg-background p-4">
        <h3 className="font-medium">2. Güncel firma listesini yükle</h3>
      <Input
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        disabled={loading || applying}
        onChange={(event) => void selectFile(event.target.files?.[0])}
      />
      {loading && (
        <p className="flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Liste karşılaştırılıyor…
        </p>
      )}
      {rows.length > 0 && (
        <div className="space-y-3 text-sm">
          <div className="grid gap-2 sm:grid-cols-4">
            <p className="rounded border bg-background p-3">
              {importFromLegacy ? "Eski Tablo kaynağı" : "Eski aktif"}: <strong>{importFromLegacy ? legacyRecordCount : activeCount}</strong>
            </p>
            <p className="rounded border bg-background p-3">Yeni ana tablo: <strong>{rows.length}</strong></p>
            <p className="rounded border bg-background p-3">
              {importFromLegacy ? "PDF dışında kalan" : "Eskiye ayrılacak"}: <strong>{removedCount}</strong>
            </p>
            <p className="rounded border bg-background p-3">Hatalı/eşleşmeyen: <strong>{invalidCount + missingCount}</strong></p>
          </div>
          {canApply ? (
            <div className="flex gap-2 rounded border border-emerald-300 bg-emerald-50 p-3 text-emerald-900">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              Tüm firmalar Üye Sicil No ile {importFromLegacy ? "Eski Tablo'da" : "sistemde"} eşleşti. Geçiş tek veritabanı işlemi olarak uygulanabilir.
            </div>
          ) : (
            <div className="flex gap-2 rounded border border-red-300 bg-red-50 p-3 text-red-900">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              Hatalı veya mevcut sistemde bulunamayan kayıtlar olduğu için işlem engellendi.
            </div>
          )}
          <Button disabled={!canApply || applying} onClick={() => void applyRoster()}>
            {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <DatabaseBackup className="h-4 w-4" />}
            {importFromLegacy ? "Eski Tablo bilgileriyle ana listeyi oluştur" : "Eski tabloyu yedekle ve güncel listeyi uygula"}
          </Button>
        </div>
      )}
      </div>
    </section>
  );
}
