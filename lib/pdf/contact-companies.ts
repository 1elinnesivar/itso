import type { TDocumentDefinitions } from "pdfmake/interfaces";
import type { FurnitureRecord } from "@/types/app";

function safeFileName(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function downloadContactCompaniesPdf(
  contactName: string,
  records: FurnitureRecord[],
) {
  const [pdfMakeModule, fontModule] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  const pdfMake = pdfMakeModule.default;
  pdfMake.addVirtualFileSystem(fontModule.default);

  const definition: TDocumentDefinitions = {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [28, 32, 28, 34],
    info: {
      title: `${contactName} - Firma Listesi`,
      subject: "Temas sorumlusu firma listesi",
    },
    content: [
      { text: "İTSO Mobilya Takip", style: "eyebrow" },
      { text: contactName, style: "title" },
      {
        text: `${records.length} firma · ${new Intl.DateTimeFormat("tr-TR", {
          dateStyle: "long",
        }).format(new Date())}`,
        style: "summary",
      },
      {
        margin: [0, 16, 0, 0],
        table: {
          headerRows: 1,
          widths: [30, "*", 58, 62, 70, 110],
          body: [
            [
              { text: "Sıra", style: "tableHeader" },
              { text: "Firma Unvanı", style: "tableHeader" },
              { text: "Üye Sicil", style: "tableHeader" },
              { text: "Durumu", style: "tableHeader" },
              { text: "Mahalle", style: "tableHeader" },
              { text: "Telefon", style: "tableHeader" },
            ],
            ...records.map((record) => [
              String(record.display_order),
              record.title,
              record.member_registry_no,
              record.status,
              record.district || "—",
              record.phone_numbers || "—",
            ]),
          ],
        },
        layout: "lightHorizontalLines",
      },
    ],
    footer: (currentPage, pageCount) => ({
      margin: [28, 8, 28, 0],
      columns: [
        { text: "İTSO Mobilya Takip", color: "#64748b", fontSize: 8 },
        {
          text: `${currentPage} / ${pageCount}`,
          alignment: "right",
          color: "#64748b",
          fontSize: 8,
        },
      ],
    }),
    defaultStyle: {
      font: "Roboto",
      fontSize: 8,
      color: "#172033",
    },
    styles: {
      eyebrow: {
        color: "#167451",
        bold: true,
        fontSize: 9,
      },
      title: {
        bold: true,
        fontSize: 18,
        margin: [0, 4, 0, 3],
      },
      summary: {
        color: "#64748b",
        fontSize: 9,
      },
      tableHeader: {
        bold: true,
        color: "#ffffff",
        fillColor: "#167451",
        margin: [2, 4, 2, 4],
      },
    },
  };

  await pdfMake
    .createPdf(definition)
    .download(`${safeFileName(contactName) || "temas-sorumlusu"}-firmalar.pdf`);
}
