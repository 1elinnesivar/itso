import { ContactsOverview } from "@/components/contacts/contacts-overview";
import { requireAdmin } from "@/lib/supabase/auth";

export default async function ContactsPage() {
  await requireAdmin();

  return (
    <section>
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Temas sorumluları</h1>
        <p className="text-sm text-muted-foreground">
          İletişim paketlerini takip edin veya kişinin profilini açın.
        </p>
      </div>
      <ContactsOverview />
    </section>
  );
}
