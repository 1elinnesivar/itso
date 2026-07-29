import { ImportPanel } from "@/components/excel/import-panel";
import { requireAdmin } from "@/lib/supabase/auth";

export default async function ImportsPage() {
  await requireAdmin();
  return (
    <section>
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Excel içe aktar</h1>
        <p className="text-sm text-muted-foreground">
          Dosya tarayıcıda okunur; önizleme onaylanmadan veritabanı değişmez.
        </p>
      </div>
      <ImportPanel />
    </section>
  );
}

