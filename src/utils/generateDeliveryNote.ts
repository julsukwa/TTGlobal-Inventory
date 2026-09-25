// ─── Delivery Note PDF ───────────────────────────────────────────────────────
//
// Generates and downloads an A4 delivery note PDF for a completed Stock Out
// transaction, matching the company's existing delivery note document.
//
// Built with jsPDF + jspdf-autotable: jsPDF alone has no table primitive, and
// the header fill/alternating-row/border/merged-group styling this document
// needs would otherwise mean hand-placing every cell's rect+line+text. That
// combination is the de-facto standard pairing for exactly this kind of PDF
// (same reasoning as reaching for xlsx-js-style over plain xlsx for styled
// spreadsheet export elsewhere in this codebase).

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { StockOutApiItem, StockOutApiTransaction } from "../pages/stock-out/stockOutTypes";

const PAGE_WIDTH = 210; // A4 portrait, mm
const PAGE_HEIGHT = 297;
const MARGIN = 14;
const CONTENT_BOTTOM = PAGE_HEIGHT - 22; // leaves room for the footer

const HEADER_FILL: [number, number, number] = [44, 62, 80]; // #2C3E50
const ALT_ROW_FILL: [number, number, number] = [248, 249, 250]; // #F8F9FA
const BORDER_COLOR: [number, number, number] = [225, 225, 225];
const TEXT_COLOR: [number, number, number] = [30, 30, 30];

const TERMS = [
  "The recipient acknowledges that the items listed above have been received in satisfactory condition.",
  "All items provided are of refurbished (previously used) condition.",
  "Warranty claims or complaints will only be entertained within 30 days of the goods being received.",
  "Goods may not be returned without prior written authorization from the company.",
  "Discrepancies, if any, must be reported within 48 hours of receipt.",
  "Goods remain the property of the company until payment is completed in full.",
];

const SIGN_OFF_FIELDS: [string, string][] = [
  ["Checked by:", "Received by:"],
  ["Delivered by:", "Vehicle no:"],
  ["ID number:", "Phone no:"],
];

interface DeliveryGroup {
  category: string;
  rows: { description: string; qty: number }[];
  itemCount: number;
}

/** Builds the 'Brand Model | Processor Generation | RAMMB | StorageGB | Comment'
 * description string, skipping any empty segment (see the module's callers
 * for the exact example this mirrors). */
function buildDescription(item: StockOutApiItem): string {
  const segments: string[] = [];

  const brandModel = [item.brand, item.model].filter(Boolean).join(" ").trim();
  if (brandModel) segments.push(brandModel);

  const procGen = [item.processor, item.generation].filter(Boolean).join(" ").trim();
  if (procGen) segments.push(procGen);

  if (item.ram) segments.push(`${item.ram}MB`);
  if (item.storage) segments.push(`${item.storage}GB`);

  let description = segments.join(" | ");
  if (item.screenType) {
    description = description ? `${description} | ${item.screenType}` : item.screenType;
  }

  return description;
}

/** Groups items by category (in first-seen order), merging rows with an
 * identical description within a group into a single row with a combined
 * qty count. */
function buildDeliveryGroups(items: StockOutApiItem[]): DeliveryGroup[] {
  const order: string[] = [];
  const byCategory = new Map<string, Map<string, number>>();

  for (const item of items) {
    const category = item.category || "Uncategorized";
    if (!byCategory.has(category)) {
      byCategory.set(category, new Map());
      order.push(category);
    }

    const descriptionCounts = byCategory.get(category)!;
    const description = buildDescription(item);
    descriptionCounts.set(description, (descriptionCounts.get(description) ?? 0) + 1);
  }

  return order.map((category) => {
    const descriptionCounts = byCategory.get(category)!;
    const rows = [...descriptionCounts.entries()].map(([description, qty]) => ({ description, qty }));
    const itemCount = rows.reduce((sum, r) => sum + r.qty, 0);
    return { category, rows, itemCount };
  });
}

/** Starts a new page and returns the reset y-cursor if the given content
 * height wouldn't fit before the footer's reserved space. */
function ensureSpace(doc: jsPDF, y: number, neededHeight: number): number {
  if (y + neededHeight <= CONTENT_BOTTOM) return y;
  doc.addPage();
  return MARGIN;
}

export function generateDeliveryNote(transaction: StockOutApiTransaction): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // ── 1. Header ─────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...TEXT_COLOR);
  doc.text("DELIVERY NOTE", PAGE_WIDTH / 2, 20, { align: "center" });

  doc.setDrawColor(...BORDER_COLOR);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, 25, PAGE_WIDTH - MARGIN, 25);

  // ── 2. Two-column info section ───────────────────────────────────────────
  const infoTop = 34;
  const lineHeight = 6.5;
  const leftLabelX = MARGIN;
  const leftValueX = MARGIN + 22;
  const rightLabelX = PAGE_WIDTH / 2 + 4;
  const rightValueX = rightLabelX + 28;

  const leftFields: [string, string][] = [
    ["Customer:", transaction.customerName],
    ["Address:", transaction.customerLocation],
    ["Phone:", transaction.customerPhone],
    ["Email:", transaction.customerEmail],
  ];
  const rightFields: [string, string][] = [
    ["Type:", "Sale"],
    ["Date:", transaction.date],
    ["Delivery No.:", `${transaction.invoiceNumber}-DN`],
    ["Reference No.:", transaction.invoiceNumber],
  ];

  doc.setFontSize(10);
  leftFields.forEach(([label, value], i) => {
    const y = infoTop + i * lineHeight;
    doc.setFont("helvetica", "bold");
    doc.text(label, leftLabelX, y);
    doc.setFont("helvetica", "normal");
    doc.text(value || "—", leftValueX, y);
  });
  rightFields.forEach(([label, value], i) => {
    const y = infoTop + i * lineHeight;
    doc.setFont("helvetica", "bold");
    doc.text(label, rightLabelX, y);
    doc.setFont("helvetica", "normal");
    doc.text(value || "—", rightValueX, y);
  });

  // ── 3. Items table ────────────────────────────────────────────────────────
  const groups = buildDeliveryGroups(transaction.items);

  const body = groups.flatMap((group) => [
    [
      {
        content: group.category,
        colSpan: 3,
        styles: {
          fontStyle: "bold" as const,
          fillColor: [255, 255, 255] as [number, number, number],
          cellPadding: { top: 2, right: 2, bottom: 1, left: 6 },
        },
      },
    ],
    ...group.rows.map((row) => [group.category, row.description, String(row.qty)]),
  ]);

  const tableStartY = infoTop + (Math.max(leftFields.length, rightFields.length) - 1) * lineHeight + 10;

  autoTable(doc, {
    startY: tableStartY,
    head: [["Type", "Description", "Qty"]],
    body,
    theme: "plain",
    margin: { left: MARGIN, right: MARGIN, bottom: 20 },
    styles: {
      font: "helvetica",
      fontSize: 9,
      textColor: TEXT_COLOR,
      lineColor: BORDER_COLOR,
      lineWidth: 0.1,
      cellPadding: 2,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: HEADER_FILL,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "left",
    },
    alternateRowStyles: {
      fillColor: ALT_ROW_FILL,
    },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 18, halign: "right" },
    },
  });

  let y =
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // ── 4. Totals section ────────────────────────────────────────────────────
  y = ensureSpace(doc, y, 10 + groups.length * 5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`Total Qty: ${transaction.totalItems}`, PAGE_WIDTH - MARGIN, y, { align: "right" });
  y += 7;

  doc.text("Summary -", MARGIN, y);
  y += 5.5;

  doc.setFont("helvetica", "normal");
  groups.forEach((group) => {
    doc.text(`${group.category}: ${group.itemCount}`, MARGIN + 4, y);
    y += 5;
  });
  y += 4;

  // ── 5. Terms and conditions ──────────────────────────────────────────────
  y = ensureSpace(doc, y, 8 + TERMS.length * 4);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Terms and Conditions", MARGIN, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  TERMS.forEach((term, i) => {
    const lines = doc.splitTextToSize(`${i + 1}. ${term}`, PAGE_WIDTH - MARGIN * 2);
    y = ensureSpace(doc, y, lines.length * 3.6);
    doc.text(lines, MARGIN, y);
    y += lines.length * 3.6;
  });
  y += 6;

  // ── 6. Sign-off section ───────────────────────────────────────────────────
  const signOffHeight = SIGN_OFF_FIELDS.length * 14 + 4;
  y = ensureSpace(doc, y, signOffHeight);

  doc.setFontSize(9);
  const signColLeftLabelX = MARGIN;
  const signColLeftLineX = MARGIN + 26;
  const signColRightLabelX = PAGE_WIDTH / 2 + 4;
  const signColRightLineX = signColRightLabelX + 26;
  const signLineWidth = 40;

  SIGN_OFF_FIELDS.forEach(([leftLabel, rightLabel]) => {
    doc.setFont("helvetica", "bold");
    doc.text(leftLabel, signColLeftLabelX, y);
    doc.text(rightLabel, signColRightLabelX, y);

    doc.setDrawColor(...TEXT_COLOR);
    doc.setLineWidth(0.2);
    doc.line(signColLeftLineX, y, signColLeftLineX + signLineWidth, y);
    doc.line(signColRightLineX, y, signColRightLineX + signLineWidth, y);

    y += 14;
  });

  // ── 7. Footer — "Page X of Y" on every page (Y is 1 for the common case
  // of a single-page note, matching the spec's literal "Page 1 of 1"). ──────
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_COLOR);
    doc.text(`Page ${page} of ${pageCount}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 10, { align: "center" });
  }

  doc.save(`${transaction.invoiceNumber}-DN.pdf`);
}
