import { ContactProfile } from "@/components/contacts/contact-profile";
import { requireAdmin } from "@/lib/nhost/auth";

export default async function ContactProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  return <ContactProfile contactId={id} />;
}
