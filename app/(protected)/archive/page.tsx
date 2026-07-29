import { requireAdmin } from "@/lib/supabase/auth";
import { ArchiveList } from "@/components/archive/archive-list";

export default async function ArchivePage() {
  await requireAdmin();
  return (
    <section>
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Arşiv</h1>
        <p className="text-sm text-muted-foreground">
          Yumuşak silinen kayıtları inceleyin veya geri alın.
        </p>
      </div>
      <ArchiveList />
    </section>
  );
}

