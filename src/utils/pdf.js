import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { COMPANY } from "./company";
import { format } from "date-fns";

const ORANGE = [232, 119, 34];
const BLACK  = [17,  24,  39];
const DARK   = [55,  65,  81];
const GRAY   = [107, 114, 128];
const LGRAY  = [243, 244, 246];
const MGRAY  = [209, 213, 219];

const M = 14; // left/right margin

// ── Shared header (logo + title + company info) ────────────────────────────

function addHeader(doc, title, docNo, date, logoDataUrl, accentColor) {
  const pageW = doc.internal.pageSize.getWidth();
  const color = accentColor || ORANGE;

  // Logo — top left, large
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", M, 8, 32, 36);
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...color);
    doc.text(COMPANY.name.toUpperCase(), M, 22);
  }

  // Title — top right, large
  doc.setFont("helvetica", "normal");
  doc.setFontSize(30);
  doc.setTextColor(...BLACK);
  doc.text(title, pageW - M, 20, { align: "right" });

  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  doc.text(`${title}#: ${docNo}`, pageW - M, 30, { align: "right" });

  // Company info — below logo
  let y = 48;
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY);
  doc.text(COMPANY.regNo, M, y); y += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...BLACK);
  doc.text(COMPANY.name.toUpperCase(), M, y); y += 4.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...DARK);
  COMPANY.address.split("\n").forEach(line => {
    doc.text(line.trim(), M, y); y += 4;
  });

  doc.setTextColor(37, 99, 235);
  doc.text(COMPANY.email, M, y); y += 4;
  doc.setTextColor(...DARK);
  doc.text(COMPANY.phone, M, y); y += 4;

  // Divider
  y += 4;
  doc.setDrawColor(...MGRAY);
  doc.setLineWidth(0.4);
  doc.line(M, y, pageW - M, y);

  return y + 7;
}

// ── Bill-to + date ─────────────────────────────────────────────────────────

function addBillTo(doc, toData, date, y, dateLabel, accentColor) {
  const pageW = doc.internal.pageSize.getWidth();
  const color = accentColor || ORANGE;

  // "Bill to:" left, date right
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BLACK);
  doc.text("Bill to:", M, y);
  doc.text(`Date: ${format(new Date(date), "d MMMM yyyy")}`, pageW - M, y, { align: "right" });
  y += 6;

  // Customer name (bold)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...BLACK);
  if (toData.name) { doc.text(toData.name, M, y); y += 5; }

  // Rest of customer info (normal)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  if (toData.attn) { doc.text(toData.attn, M, y); y += 4.5; }
  if (toData.address) {
    const lines = doc.splitTextToSize(toData.address, pageW - M * 2);
    doc.text(lines, M, y); y += lines.length * 4.5;
  }
  if (toData.contact) { doc.text(toData.contact, M, y); y += 4.5; }
  if (toData.email)   { doc.text(toData.email,   M, y); y += 4.5; }

  return y + 6;
}

// ── Items table ────────────────────────────────────────────────────────────

function addItemsTable(doc, items, y, showPrice, headerColor) {
  const color = headerColor || ORANGE;

  if (showPrice) {
    const rows = items.map((item, i) => [
      i + 1,
      item.description,
      item.qty,
      `RM${Number(item.unitPrice || 0).toFixed(2)}`,
      `RM${(Number(item.qty || 0) * Number(item.unitPrice || 0)).toFixed(2)}`,
    ]);

    const subtotal = items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unitPrice) || 0), 0);
    const taxRate  = doc.__taxRate || 0;
    const tax      = subtotal * taxRate / 100;
    const total    = subtotal + tax;

    autoTable(doc, {
      startY: y,
      head: [["No.", "Items & Descriptions", "Quantity", "Price", "Amount"]],
      body: rows,
      foot: [[
        { content: "Total Amount", colSpan: 4, styles: { halign: "right", fontStyle: "bold", fillColor: [...LGRAY], textColor: [...BLACK] } },
        { content: `RM${total.toFixed(2)}`,   styles: { fontStyle: "bold", fillColor: [...LGRAY], textColor: [...BLACK] } },
      ]],
      styles:     { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: color, textColor: 255, fontStyle: "bold" },
      footStyles: { textColor: [...BLACK] },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      columnStyles: {
        0: { cellWidth: 12, halign: "center" },
        2: { cellWidth: 24, halign: "center" },
        3: { cellWidth: 30, halign: "right"  },
        4: { cellWidth: 30, halign: "right"  },
      },
      margin: { left: M, right: M },
    });

    return { finalY: doc.lastAutoTable.finalY, total };
  } else {
    const rows = items.map((item, i) => [i + 1, item.description, item.qty, item.unit || "unit", item.notes || ""]);
    autoTable(doc, {
      startY: y,
      head: [["No.", "Items & Descriptions", "Qty", "Unit", "Notes"]],
      body: rows,
      styles:     { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: color, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      columnStyles: {
        0: { cellWidth: 12, halign: "center" },
        2: { cellWidth: 16, halign: "center" },
        3: { cellWidth: 22, halign: "center" },
      },
      margin: { left: M, right: M },
    });
    const totalQty = items.reduce((s, i) => s + (Number(i.qty) || 0), 0);
    return { finalY: doc.lastAutoTable.finalY, total: totalQty };
  }
}

// ── Terms & Conditions ─────────────────────────────────────────────────────

function addTerms(doc, y, depositAmt) {
  const pageW   = doc.internal.pageSize.getWidth();
  const deposit = depositAmt ? `RM${depositAmt.toFixed(2)}` : "as agreed";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...BLACK);
  doc.text("Terms & Conditions", M, y); y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...DARK);

  const terms = [
    `1) A deposit must be paid to proceed with purchasing items and project execution. Deposit amount: ${deposit}.`,
    `2) The balance payment is required to proceed with the delivery of the order.`,
    `3) Goods sold are neither returnable nor refundable.`,
    `4) Any discrepancies must be reported to us within 7 days. Otherwise, goods sold are deemed accepted and confirmed by the customer.`,
  ];

  terms.forEach(t => {
    const lines = doc.splitTextToSize(t, pageW - M * 2);
    doc.text(lines, M, y);
    y += lines.length * 4.2 + 1.5;
  });

  return y + 5;
}

// ── Bank / account details ─────────────────────────────────────────────────

function addBankDetails(doc, y) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...BLACK);
  doc.text("Account Number :", M, y); y += 5;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...DARK);
  doc.text(COMPANY.bank,            M, y); y += 5;
  doc.text(COMPANY.bankAccountName, M, y); y += 5;
  doc.text(COMPANY.bankAccount,     M, y);
}

// ── Footer ─────────────────────────────────────────────────────────────────

function addFooter(doc) {
  const pages = doc.internal.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(`Page ${i} of ${pages}`,                pageW - M, pageH - 6, { align: "right" });
    doc.text("This document is computer generated.", M,         pageH - 6);
  }
}

// ── Public generators ──────────────────────────────────────────────────────

export function generateQuotation(docData, logoDataUrl) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.__taxRate = Number(docData.taxRate) || 0;

  let y = addHeader(doc, "Quotation", docData.docNo, docData.date, logoDataUrl, ORANGE);
  y = addBillTo(doc, { ...docData.to, __docNo: docData.docNo }, docData.date, y, "Quotation Date", ORANGE);
  const { finalY, total } = addItemsTable(doc, docData.items, y, true, ORANGE);
  y = addTerms(doc, finalY + 10, total * 0.8);
  addBankDetails(doc, y);
  addFooter(doc);

  return doc.output("arraybuffer");
}

export function generateInvoice(docData, logoDataUrl) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.__taxRate = Number(docData.taxRate) || 0;

  let y = addHeader(doc, "Invoice", docData.docNo, docData.date, logoDataUrl, ORANGE);
  y = addBillTo(doc, { ...docData.to, __docNo: docData.docNo }, docData.date, y, "Invoice Date", ORANGE);
  const { finalY } = addItemsTable(doc, docData.items, y, true, ORANGE);
  y = finalY + 10;

  // Payment note
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...BLACK);
  doc.text("Account Number :", M, y); y += 5;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...DARK);
  doc.text(COMPANY.bank,            M, y); y += 5;
  doc.text(COMPANY.bankAccountName, M, y); y += 5;
  doc.text(COMPANY.bankAccount,     M, y); y += 8;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text("Please make payment within 14 days of invoice date.", M, y);

  addFooter(doc);
  return doc.output("arraybuffer");
}

export function generatePO(docData, logoDataUrl) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.__taxRate = Number(docData.taxRate) || 0;

  let y = addHeader(doc, "Purchase Order", docData.docNo, docData.date, logoDataUrl, ORANGE);
  y = addBillTo(doc, { ...docData.to, __docNo: docData.docNo }, docData.date, y, "PO Date", ORANGE);
  const { finalY } = addItemsTable(doc, docData.items, y, true, ORANGE);

  // Approval signature
  const pageW = doc.internal.pageSize.getWidth();
  y = finalY + 16;
  doc.setDrawColor(...MGRAY);
  doc.line(pageW - 80, y, pageW - M, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...DARK);
  doc.text("Approved by",   pageW - 80, y + 5);
  doc.text(COMPANY.name,    pageW - 80, y + 10);

  addFooter(doc);
  return doc.output("arraybuffer");
}

export function generateDO(docData, logoDataUrl) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  let y = addHeader(doc, "Delivery Order", docData.docNo, docData.date, logoDataUrl, ORANGE);
  y = addBillTo(doc, { ...docData.to, __docNo: docData.docNo }, docData.date, y, "DO Date", ORANGE);
  const { finalY } = addItemsTable(doc, docData.items, y, false, ORANGE);

  const pageW = doc.internal.pageSize.getWidth();
  y = finalY + 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...BLACK);
  doc.text("Received by:", M, y); y += 8;

  doc.setDrawColor(...MGRAY);
  doc.line(M,            y + 12, 90,         y + 12);
  doc.line(pageW - 80,   y + 12, pageW - M,  y + 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text("Name / Signature / Date", M,          y + 17);
  doc.setTextColor(...DARK);
  doc.text("Delivered by",            pageW - 80, y + 17);
  doc.text(COMPANY.name,              pageW - 80, y + 22);

  addFooter(doc);
  return doc.output("arraybuffer");
}
