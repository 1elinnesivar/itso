import fs from "node:fs";
import process from "node:process";
import XLSX from "xlsx-js-style";

const expectedHeaders = [
  "Sıra",
  "Üye Sicil No",
  "Ticaret Sicil No",
  "Meslek Grubu",
  "Durumu",
  "Unvan",
  "Yetkililer",
  "KÖKEN",
  "OY DURUMU",
  "TEMAS 1",
  "TEMAS 2",
  "TEMAS 3",
  "TEMAS 4",
  "NOTLAR",
  "MAHALLE",
  "CADDE",
  "Tescil Adresi",
  "Telefon Numaraları",
];

const fileName = process.argv[2];
if (!fileName || !fs.existsSync(fileName)) {
  console.error("Kullanım: npm run validate:workbook -- <dosya.xlsx>");
  process.exit(1);
}

const workbook = XLSX.readFile(fileName, { raw: false });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
const headers = Object.keys(rows[0] ?? {});
const missing = expectedHeaders.filter((header) => !headers.includes(header));
if (missing.length) {
  console.error(`Eksik sütunlar: ${missing.join(", ")}`);
  process.exit(1);
}

const memberNumbers = rows.map((row) => String(row["Üye Sicil No"]).trim());
const duplicateMembers = memberNumbers.length - new Set(memberNumbers).size;
const contacts = new Set(
  rows.flatMap((row) =>
    ["TEMAS 1", "TEMAS 2", "TEMAS 3", "TEMAS 4"]
      .map((header) => String(row[header]).trim())
      .filter(Boolean),
  ),
);

console.log(
  JSON.stringify(
    {
      sheet: workbook.SheetNames[0],
      rows: rows.length,
      columns: headers.length,
      duplicateMemberNumbers: duplicateMembers,
      contactPeople: contacts.size,
      statuses: rows.reduce((counts, row) => {
        const status = String(row.Durumu || "(Boş)");
        counts[status] = (counts[status] ?? 0) + 1;
        return counts;
      }, {}),
    },
    null,
    2,
  ),
);
