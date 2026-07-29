import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeLineEndings(value: unknown): string | null {
  const normalized = String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .trim();
  return normalized || null;
}
