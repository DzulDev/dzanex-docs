import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { COMPANY } from "./company";
import { format } from "date-fns";

const TEAL  = [87, 169, 169];
const CORAL = [232, 145, 122];
const BLACK = [17,  24,  39];
const DARK  = [55,  65,  81];
const GRAY  = [107, 114, 128];
const LGRAY = [243, 244, 246];
const MGRAY = [209, 213, 219];

const M = 14;

function addHeader(doc, title, docNo, date, logoDataUrl) {
  const pageW = doc.internal.pageSize.getWidth();

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", M, 8, 26, 30);
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...TEAL);
    doc.text(COMPANY.name.toUpperCase(), M, 22);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(30);
  doc.setTextColor(...BLACK);
  doc.text(title, pageW - M, 20, { align: "right" });
  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  doc.text(`${title}#: ${docNo}`, pageW - M, 30, { align: "right" });

  let y = logoDataUrl ? 41 : 48;
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
  COMPANY.address.split("\n").forEach(line => { doc.text(line.trim(), M, y); y += 4; });

  doc.setTextColor(37, 99, 235);
  doc.text(COMPANY.email, M, y); y += 4;
  doc.setTextColor(...DARK);
  doc.text(COMPANY.phone, M, y); y += 4;

  y += 4;
  doc.setDrawColor(...CORAL);
  doc.setLineWidth(0.6);
  doc.line(M, y, pageW - M, y);

  return y + 7;
}

function addBillTo(doc, toData, date, y) {
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BLACK);
  doc.text("Bill to:", M, y);
  doc.text(`Date: ${format(new Date(date), "d MMMM yyyy")}`, pageW - M, y, { align: "right" });
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...BLACK);
  if (toData.name) { doc.text(toData.name, M, y); y += 5; }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  if (toData.attn)    { doc.text(toData.attn,    M, y); y += 4.5; }
  if (toData.address) {
    const lines = doc.splitTextToSize(toData.address, pageW - M * 2);
    doc.text(lines, M, y); y += lines.length * 4.5;
  }
  if (toData.contact) { doc.text(toData.contact, M, y); y += 4.5; }
  if (toData.email)   { doc.text(toData.email,   M, y); y += 4.5; }

  return y + 6;
}

function addSectionTitle(doc, subject, y) {
  if (!subject || !subject.trim()) return y;
  const pageW = doc.internal.pageSize.getWidth();
  const text  = subject.trim().toUpperCase();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...BLACK);
  doc.text(text, pageW / 2, y, { align: "center" });
  const w = doc.getTextWidth(text);
  doc.setDrawColor(...DARK);
  doc.setLineWidth(0.3);
  doc.line(pageW / 2 - w / 2, y + 1, pageW / 2 + w / 2, y + 1);
  return y + 8;
}

function addItemsTable(doc, items, y, showPrice) {
  if (showPrice) {
    const taxRate  = doc.__taxRate || 0;
    const subtotal = items.reduce((s, i) => s + (parseFloat(i.qty) || 0) * (parseFloat(i.unitPrice) || 0), 0);
    const total    = subtotal + subtotal * taxRate / 100;

    // Track items that need bold-main + normal-bullets split rendering
    const splitBold = {};
    const rows = items.map((item, i) => {
      const qtyDisplay = item.unit === "l/s" ? "l/s" : `${item.qty} ${item.unit || ""}`.trim();
      const bullets = item.notes && item.notes.trim()
        ? item.notes.split("\n").filter(l => l.trim()).map(l => `  • ${l.trim()}`)
        : [];
      const desc = bullets.length
        ? item.description + "\n" + bullets.join("\n")
        : item.description;
      if (item.isBold && bullets.length) {
        splitBold[i] = { main: item.description, bullets };
      }
      const qty   = parseFloat(item.qty)      || 0;
      const price = parseFloat(item.unitPrice) || 0;
      return [
        i + 1,
        { content: desc, styles: { fontStyle: item.isBold ? "bold" : "normal" } },
        qtyDisplay,
        `RM ${price.toFixed(2)}`,
        `RM ${(qty * price).toFixed(2)}`,
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [["No.", "Items & Descriptions", "Quantity", "Price", "Amount"]],
      body: rows,
      foot: [[
        { content: "Total Amount", colSpan: 4, styles: { halign: "right", fontStyle: "bold", fillColor: [...LGRAY], textColor: [...BLACK] } },
        { content: `RM ${total.toFixed(2)}`, styles: { fontStyle: "bold", fillColor: [...LGRAY], textColor: [...BLACK] } },
      ]],
      showFoot:           "everyPage",
      rowPageBreak:       "avoid",
      styles:             { fontSize: 9, cellPadding: 3 },
      headStyles:         { fillColor: TEAL, textColor: 255, fontStyle: "bold" },
      footStyles:         { textColor: [...BLACK] },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      columnStyles: {
        0: { cellWidth: 12, halign: "center" },
        2: { cellWidth: 24, halign: "center" },
        3: { cellWidth: 30, halign: "right"  },
        4: { cellWidth: 30, halign: "right"  },
      },
      margin: { left: M, right: M },
      didDrawCell: (data) => {
        if (data.section !== "body" || data.column.index !== 1) return;
        const split = splitBold[data.row.index];
        if (!split) return;
        const cp = 3;
        const isAlt = data.row.index % 2 !== 0;
        // Erase the all-bold auto-render, preserve borders
        doc.setFillColor(...(isAlt ? [250, 250, 250] : [255, 255, 255]));
        doc.rect(data.cell.x + 0.5, data.cell.y + 0.5, data.cell.width - 1, data.cell.height - 1, "F");
        const textX = data.cell.x + cp;
        const maxW  = data.cell.width - cp * 2;
        let   textY = data.cell.y + cp + 3;
        doc.setFontSize(9);
        doc.setTextColor(...BLACK);
        // Bold — main description only
        doc.setFont("helvetica", "bold");
        const mainLines = doc.splitTextToSize(split.main, maxW);
        doc.text(mainLines, textX, textY);
        textY += mainLines.length * 4.5;
        // Normal — bullet sub-descriptions
        doc.setFont("helvetica", "normal");
        split.bullets.forEach(line => {
          const wrapped = doc.splitTextToSize(line, maxW);
          doc.text(wrapped, textX, textY);
          textY += wrapped.length * 4.5;
        });
      },
    });

    return { finalY: doc.lastAutoTable.finalY, total };
  } else {
    const rows = items.map((item, i) => [i + 1, item.description, item.qty, item.unit || "unit", item.notes || ""]);
    autoTable(doc, {
      startY: y,
      head: [["No.", "Items & Descriptions", "Qty", "Unit", "Notes"]],
      body: rows,
      styles:             { fontSize: 9, cellPadding: 3 },
      headStyles:         { fillColor: TEAL, textColor: 255, fontStyle: "bold" },
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

function addTerms(doc, y, depositAmt, paymentTerms, customTerms) {
  const pageW   = doc.internal.pageSize.getWidth();

  if (paymentTerms) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...BLACK);
    doc.text("Payment Terms", M, y); y += 5;

    doc.setFillColor(...LGRAY);
    doc.roundedRect(M, y - 1, pageW - M * 2, 8, 1.5, 1.5, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...BLACK);
    doc.text(paymentTerms, M + 3, y + 4.5);
    y += 13;
  }

  const enabledTerms = Array.isArray(customTerms)
    ? customTerms.filter(t => t.enabled && t.text.trim())
    : null;

  if (!enabledTerms || enabledTerms.length === 0) return y;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...BLACK);
  doc.text("Terms & Conditions", M, y); y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...DARK);

  enabledTerms.forEach((t, i) => {
    const lines = doc.splitTextToSize(`${i + 1}) ${t.text}`, pageW - M * 2);
    doc.text(lines, M, y);
    y += lines.length * 4 + 1.5;
  });

  return y + 5;
}

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
  return y + 5;
}

function addSignature(doc, y, type) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const mid   = pageW / 2 + 5;
  const SIG_H = 45; // space needed

  // Start new page if not enough room
  if (y + SIG_H > pageH - 15) { doc.addPage(); y = 20; }

  const leftEnd  = mid - 10;
  const rightEnd = pageW - M;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...BLACK);

  if (type === "quotation") {
    doc.text("Accepted by:", M, y);
    doc.text("Submitted by:", mid, y);
  } else {
    doc.text("Issued by:", mid, y);
  }
  y += 22; // signature space

  // Signature lines
  doc.setDrawColor(...MGRAY);
  doc.setLineWidth(0.4);
  if (type === "quotation") doc.line(M, y, leftEnd, y);
  doc.line(mid, y, rightEnd, y);
  y += 4;

  // Labels under lines
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY);
  if (type === "quotation") doc.text("Signature & Stamp", M, y);
  doc.text("Signature & Stamp", mid, y);
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...BLACK);
  if (type === "quotation") {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...DARK);
    doc.text("Date: _____________________", M, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BLACK);
  }
  doc.text(COMPANY.name, mid, y); y += 4;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...DARK);
  doc.text("Date: _____________________", mid, y);

  return y + 8;
}

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

export function generateQuotation(docData, logoDataUrl) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.__taxRate = Number(docData.taxRate) || 0;

  let y = addHeader(doc, "Quotation", docData.docNo, docData.date, logoDataUrl);
  y = addBillTo(doc, docData.to, docData.date, y);
  y = addSectionTitle(doc, docData.subject, y);
  const { finalY, total } = addItemsTable(doc, docData.items, y, true);
  y = addTerms(doc, finalY + 10, total * 0.8, docData.paymentTerms, docData.terms);
  y = addBankDetails(doc, y);
  addSignature(doc, y + 5, "quotation");
  addFooter(doc);

  return doc.output("arraybuffer");
}

export function generateInvoice(docData, logoDataUrl) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.__taxRate = Number(docData.taxRate) || 0;

  let y = addHeader(doc, "Invoice", docData.docNo, docData.date, logoDataUrl);
  y = addBillTo(doc, docData.to, docData.date, y);
  y = addSectionTitle(doc, docData.subject, y);
  const { finalY } = addItemsTable(doc, docData.items, y, true);
  y = finalY + 10;

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
  doc.text("Please make payment within 14 days of invoice date.", M, y); y += 8;

  addSignature(doc, y, "invoice");
  addFooter(doc);
  return doc.output("arraybuffer");
}

export function generatePO(docData, logoDataUrl) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.__taxRate = Number(docData.taxRate) || 0;

  let y = addHeader(doc, "Purchase Order", docData.docNo, docData.date, logoDataUrl);
  y = addBillTo(doc, docData.to, docData.date, y);
  y = addSectionTitle(doc, docData.subject, y);
  const { finalY } = addItemsTable(doc, docData.items, y, true);

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

  let y = addHeader(doc, "Delivery Order", docData.docNo, docData.date, logoDataUrl);
  y = addBillTo(doc, docData.to, docData.date, y);
  y = addSectionTitle(doc, docData.subject, y);
  const { finalY } = addItemsTable(doc, docData.items, y, false);

  const pageW = doc.internal.pageSize.getWidth();
  y = finalY + 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...BLACK);
  doc.text("Received by:", M, y); y += 8;

  doc.setDrawColor(...MGRAY);
  doc.line(M,          y + 12, 90,        y + 12);
  doc.line(pageW - 80, y + 12, pageW - M, y + 12);

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
