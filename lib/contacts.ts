export interface ParsedContactDisplayName {
  name: string;
  communicationLines: string[];
}

const parenthesizedNumberPattern = /\(([^)]*\d[^)]*)\)/g;

export function parseContactDisplayName(
  displayName: string,
): ParsedContactDisplayName {
  const communicationLines = Array.from(
    displayName.matchAll(parenthesizedNumberPattern),
    (match) => match[1].trim(),
  ).filter(Boolean);
  const name = displayName
    .replace(parenthesizedNumberPattern, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    name: name || "İsimsiz temas sorumlusu",
    communicationLines,
  };
}
