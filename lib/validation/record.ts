import { z } from "zod";

const optionalText = z
  .string()
  .transform((value) => value.replace(/\r\n?/g, "\n").trim())
  .transform((value) => value || null);

export const recordSchema = z.object({
  member_registry_no: z.string().trim().min(1, "Üye Sicil No zorunlu."),
  trade_registry_no: optionalText,
  profession_group: z.string().trim().min(1, "Meslek Grubu zorunlu."),
  status: z.string().trim().min(1, "Durum zorunlu."),
  title: z.string().trim().min(1, "Unvan zorunlu."),
  officials: optionalText,
  origin: optionalText,
  vote_status: optionalText,
  notes: optionalText,
  district: optionalText,
  street: optionalText,
  registered_address: z.string().trim(),
  phone_numbers: z.string().transform((value) => value.replace(/\r\n?/g, "\n").trim()),
});

export type RecordFormValues = z.input<typeof recordSchema>;
export type RecordParsedValues = z.output<typeof recordSchema>;
