import { LegacyTableView } from "@/components/legacy/legacy-table-view";
import { requireAdmin } from "@/lib/supabase/auth";

export default async function LegacyTablePage() {
  await requireAdmin();
  return (
    <section>
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Eski Tablo</h1>
        <p className="text-sm text-muted-foreground">
          Güncel liste geçişinden önce saklanan kayıtları tüm detaylarıyla inceleyin ve Excel olarak indirin.
        </p>
      </div>
      <LegacyTableView />
    </section>
  );
}
