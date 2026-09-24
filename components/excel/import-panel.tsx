"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseWorkbook, type ParsedExcelRow } from "@/lib/excel/records";
import { fetchAllRecords } from "@/lib/records";
import { createClient } from "@/lib/supabase/client";
import { normalizeText } from "@/lib/utils";
import type { FurnitureRecord } from "@/types/app";

type Category = "new" | "changed" | "same" | "invalid" | "deleted_conflict";
interface PreviewRow {
  row_number: number;
  data: ParsedExcelRow;
  category: Category;
  validation_errors: string[];
  record_id: string | null;
  staged_version: number | null;
}

const labels: Record<Category, string> = {
  new: "Yeni",
  changed: "Değişen",
  same: "Aynı",
  invalid: "Hatalı",
  deleted_conflict: "Arşiv çakışması",
};

function comparableParsed(row: ParsedExcelRow) {
  return normalizeText(
    JSON.stringify({
      order: row.display_order,
      member: row.member_registry_no,
      trade: row.trade_registry_no,
      profession: row.profession_group,
      status: row.status,
      title: row.title,
      officials: row.officials,
      origin: row.origin,
      vote: row.vote_status,
      contacts: row.contact_names,
      notes: row.notes,
      district: row.district,
      street: row.street,
      address: row.registered_address,
      phones: row.phone_numbers,
      rowColor: row.row_color,
      gift: row.gift,
    }),
  );
}

function comparableRecord(record: FurnitureRecord) {
  return normalizeText(
    JSON.stringify({
      order: record.display_order,
      member: record.member_registry_no,
      trade: record.trade_registry_no,
      profession: record.profession_group,
      status: record.status,
      title: record.title,
      officials: record.officials,
      origin: record.origin,
      vote: record.vote_status,
      contacts: [...record.record_contacts]
        .sort((a, b) => a.position - b.position)
        .map((item) => item.contact_people.display_name),
      notes: record.notes,
      district: record.district,
      street: record.street,
      address: record.registered_address,
      phones: record.phone_numbers,
      rowColor: record.row_color,
      gift: record.gift,
    }),
  );
}

export function ImportPanel() {
  const queryClient = useQueryClient();
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  async function selectFile(file: File | undefined) {
    if (!file) return;
    setLoading(true);
    setPreview([]);
    setFileName(file.name);
    try {
      const [rows, active, deleted] = await Promise.all([
        parseWorkbook(file),
        fetchAllRecords(false),
        fetchAllRecords(true),
      ]);
      const activeByMember = new Map(active.map((record) => [record.member_registry_no, record]));
      const deletedByMember = new Map(deleted.map((record) => [record.member_registry_no, record]));
      const memberCounts = new Map<string, number>();
      const orderCounts = new Map<number, number>();
      rows.forEach((row) => {
        memberCounts.set(row.member_registry_no, (memberCounts.get(row.member_registry_no) ?? 0) + 1);
        orderCounts.set(row.display_order, (orderCounts.get(row.display_order) ?? 0) + 1);
      });

      setPreview(
        rows.map((row) => {
          const errors = [...row.validation_errors];
          if ((memberCounts.get(row.member_registry_no) ?? 0) > 1) errors.push("Dosyada Üye Sicil No tekrarı var.");
          if ((orderCounts.get(row.display_order) ?? 0) > 1) errors.push("Dosyada Sıra tekrarı var.");
          const existing = activeByMember.get(row.member_registry_no);
          const archived = deletedByMember.get(row.member_registry_no);
          let category: Category;
          if (errors.length) category = "invalid";
          else if (archived) category = "deleted_conflict";
          else if (!existing) category = "new";
          else category = comparableParsed(row) === comparableRecord(existing) ? "same" : "changed";
          return {
            row_number: row.row_number,
            data: row,
            category,
            validation_errors: errors,
            record_id: existing?.id ?? archived?.id ?? null,
            staged_version: existing?.version ?? archived?.version ?? null,
          };
        }),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Excel dosyası okunamadı.");
    } finally {
      setLoading(false);
    }
  }

  const counts = preview.reduce<Record<Category, number>>(
    (acc, row) => ({ ...acc, [row.category]: acc[row.category] + 1 }),
    { new: 0, changed: 0, same: 0, invalid: 0, deleted_conflict: 0 },
  );
  const canApply = preview.length > 0 && counts.invalid === 0 && counts.deleted_conflict === 0;

  async function apply() {
    setApplying(true);
    const supabase = createClient();
    const stagedRows = preview.map((row) => ({
      row_number: row.row_number,
      data: row.data,
      category: row.category,
      validation_errors: row.validation_errors,
      record_id: row.record_id,
      staged_version: row.staged_version,
    }));
    const { data: batch, error: stageError } = await supabase.rpc("stage_import", {
      p_file_name: fileName,
      p_rows: stagedRows,
    });
    if (stageError) {
      setApplying(false);
      console.error("stage_import failed", stageError);
      toast.error(`İçe aktarma hazırlığı kaydedilemedi: ${stageError.message}`);
      return;
    }
    const { error } = await supabase.rpc("apply_import", { p_batch_id: batch.id });
    setApplying(false);
    if (error) {
      console.error("apply_import failed", error);
      const message =
        error.code === "40001"
          ? "Veriler önizlemeden sonra değişti. Dosyayı yeniden önizleyin."
          : `İçe aktarma uygulanamadı: ${error.message}`;
      toast.error(message, { duration: 12_000 });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["records"] });
    toast.success(`${counts.new} kayıt eklendi, ${counts.changed} kayıt güncellendi.`);
    setPreview([]);
    setFileName("");
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-dashed bg-background p-8 text-center">
        <FileSpreadsheet className="mx-auto h-10 w-10 text-primary" />
        <h2 className="mt-3 font-semibold">Excel dosyası seçin</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Beklenen biçim: 18 temel sütun; HEDİYE sütunu isteğe bağlı .xlsx dosyası
        </p>
        <label className="mt-5 inline-block">
          <Input
            className="max-w-sm cursor-pointer"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            disabled={loading || applying}
            onChange={(event) => void selectFile(event.target.files?.[0])}
          />
        </label>
        {loading && <p className="mt-4 flex items-center justify-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Dosya inceleniyor...</p>}
      </div>

      {preview.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(labels) as Category[]).map((category) => (
              <Badge key={category} variant={category === "invalid" || category === "deleted_conflict" ? "destructive" : "secondary"}>
                {labels[category]}: {counts[category]}
              </Badge>
            ))}
          </div>
          {(counts.invalid > 0 || counts.deleted_conflict > 0) && (
            <div className="flex gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              Hatalı satırları düzeltin. Arşiv çakışmalarında ilgili kaydı önce Arşiv ekranından geri alın.
            </div>
          )}
          {canApply && (
            <div className="flex gap-3 rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              Önizleme uygulanabilir. Dosyada olmayan mevcut kayıtlar silinmeyecek.
            </div>
          )}
          <div className="max-h-96 overflow-auto rounded-lg border bg-background">
            <table className="w-full min-w-[800px] text-sm">
              <thead className="sticky top-0 bg-muted text-left">
                <tr><th className="p-3">Excel satırı</th><th className="p-3">Üye Sicil No</th><th className="p-3">Unvan</th><th className="p-3">Durum</th><th className="p-3">Açıklama</th></tr>
              </thead>
              <tbody>
                {preview.map((row) => (
                  <tr key={row.row_number} className="border-t">
                    <td className="p-3">{row.row_number}</td>
                    <td className="p-3">{row.data.member_registry_no}</td>
                    <td className="max-w-md p-3">{row.data.title}</td>
                    <td className="p-3"><Badge variant={row.category === "invalid" || row.category === "deleted_conflict" ? "destructive" : "secondary"}>{labels[row.category]}</Badge></td>
                    <td className="p-3 text-destructive">{row.validation_errors.join(" ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => void apply()} disabled={!canApply || applying}>
              {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              İçe aktarmayı uygula
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
