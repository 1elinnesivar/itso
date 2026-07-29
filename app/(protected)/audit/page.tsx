import { AuditList } from "@/components/audit/audit-list";
import { requireAdmin } from "@/lib/supabase/auth";

export default async function AuditPage() {
  await requireAdmin();
  return (
    <section>
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Denetim kayıtları</h1>
        <p className="text-sm text-muted-foreground">
          Son 500 veri değişikliği. Ayrıntılar yalnız adminlere görünür.
        </p>
      </div>
      <AuditList />
    </section>
  );
}

