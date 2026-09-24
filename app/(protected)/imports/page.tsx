import { ImportPanel } from "@/components/excel/import-panel";
import { CurrentRosterPanel } from "@/components/excel/current-roster-panel";
import { requireAdmin } from "@/lib/nhost/auth";

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
      <div className="space-y-8">
        <CurrentRosterPanel />
        <ImportPanel />
      </div>
    </section>
  );
}
