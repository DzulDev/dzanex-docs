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

// Formats a number to "RM 1,234.56" for use in PDF cells
function rm(n) {
  return `RM ${Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

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
    // Description column inner width: A4(210) - margins(28) - fixed cols(96) - padding(6) = 80mm
    const DESC_INNER_W = 80;
    const rows = items.map((item, i) => {
      const qtyDisplay = item.unit === "l/s" ? "l/s" : `${item.qty} ${item.unit || ""}`.trim();
      const bullets = item.notes && item.notes.trim()
        ? item.notes.split("\n").filter(l => l.trim()).map(l => `  • ${l.trim()}`)
        : [];
      const desc = bullets.length
        ? item.description + "\n" + bullets.join("\n")
        : item.description;
      const descStyles = { fontStyle: item.isBold ? "bold" : "normal" };
      if (item.isBold) {
        splitBold[i] = { main: item.description, bullets };
        if (bullets.length) {
          // Pre-calc cell height so didDrawCell text isn't clipped when bullets wrap
          const cp = 3;
          const mainLines = doc.splitTextToSize(item.description, DESC_INNER_W);
          let neededH = cp * 2 + 3 + mainLines.length * 4.5;
          bullets.forEach(b => { neededH += doc.splitTextToSize(b, DESC_INNER_W).length * 4.5; });
          descStyles.minCellHeight = neededH;
        }
      }
      const qty   = parseFloat(item.qty)      || 0;
      const price = parseFloat(item.unitPrice) || 0;
      return [
        i + 1,
        { content: desc, styles: descStyles },
        qtyDisplay,
        rm(price),
        rm(qty * price),
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [["No.", "Items & Descriptions", "Quantity", "Price", "Amount"]],
      body: rows,
      foot: [[
        { content: "Total Amount", colSpan: 4, styles: { halign: "right", fontStyle: "bold", fillColor: [...MGRAY], textColor: [...BLACK] } },
        { content: rm(total), styles: { fontStyle: "bold", fillColor: [...MGRAY], textColor: [...BLACK], halign: "right" } },
      ]],
      showFoot:           "lastPage",
      rowPageBreak:       "avoid",
      styles:             { fontSize: 9, cellPadding: 3 },
      headStyles:         { fillColor: TEAL, textColor: 255, fontStyle: "bold" },
      bodyStyles:         { fillColor: [242, 242, 242] },
      alternateRowStyles: { fillColor: [242, 242, 242] },
      footStyles:         { textColor: [...BLACK] },
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
        // Erase the all-bold auto-render, preserve borders
        doc.setFillColor(242, 242, 242);
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
      bodyStyles:         { fillColor: [242, 242, 242] },
      alternateRowStyles: { fillColor: [242, 242, 242] },
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
  doc.setFontSize(7);
  doc.setTextColor(...DARK);
  doc.text(COMPANY.bank,            M, y); y += 4;
  doc.text(COMPANY.bankAccountName, M, y); y += 4;
  doc.text(COMPANY.bankAccount,     M, y);
  return y + 5;
}

function addSignature(doc, y, type, stampDataUrl, date, signatureDataUrl) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const mid   = pageW / 2 + 5;
  const SIG_H = 45; // space needed

  // Start new page if not enough room
  if (y + SIG_H > pageH - 15) { doc.addPage(); y = 20; }

  const leftEnd  = mid - 10;
  const rightEnd = pageW - M;
  const dateStr  = date ? format(new Date(date), "d MMMM yyyy") : "";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...BLACK);

  if (type === "quotation") {
    doc.text("Accepted by:", M, y);
    doc.text("Submitted by:", mid, y);
  } else {
    doc.text("Issued by:", mid, y);
  }

  // Signature image — above the line, in the company column
  if (signatureDataUrl) {
    const sigW = 36;
    const sigH = 14;
    const sigX = mid + (rightEnd - mid - sigW) / 2;
    doc.addImage(signatureDataUrl, "PNG", sigX, y + 3, sigW, sigH);
  }

  // Stamp — 18mm, centered in the company column
  if (stampDataUrl) {
    const stampSize = 18;
    const stampX = mid + (rightEnd - mid - stampSize) / 2;
    doc.addImage(stampDataUrl, "PNG", stampX, y + 2, stampSize, stampSize);
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
  doc.text(`Date: ${dateStr}`, mid, y);

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

export function generateQuotation(docData, logoDataUrl, stampDataUrl, signatureDataUrl) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.__taxRate = Number(docData.taxRate) || 0;

  let y = addHeader(doc, "Quotation", docData.docNo, docData.date, logoDataUrl);
  y = addBillTo(doc, docData.to, docData.date, y);
  y = addSectionTitle(doc, docData.subject, y);
  const { finalY, total } = addItemsTable(doc, docData.items, y, true);
  y = addTerms(doc, finalY + 10, total * 0.8, docData.paymentTerms, docData.terms);
  y = addBankDetails(doc, y);
  addSignature(doc, y + 5, "quotation", stampDataUrl, docData.date, signatureDataUrl);
  addFooter(doc);

  return doc.output("arraybuffer");
}

export function generateInvoice(docData, logoDataUrl, stampDataUrl, signatureDataUrl) {
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
  doc.setFontSize(7);
  doc.setTextColor(...DARK);
  doc.text(COMPANY.bank,            M, y); y += 4;
  doc.text(COMPANY.bankAccountName, M, y); y += 4;
  doc.text(COMPANY.bankAccount,     M, y); y += 8;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text("Please make payment within 14 days of invoice date.", M, y);

  addSignature(doc, y + 8, "invoice", stampDataUrl, docData.date, signatureDataUrl);
  addFooter(doc);
  return doc.output("arraybuffer");
}

export function generatePO(docData, logoDataUrl, stampDataUrl, signatureDataUrl) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.__taxRate = Number(docData.taxRate) || 0;

  let y = addHeader(doc, "Purchase Order", docData.docNo, docData.date, logoDataUrl);
  y = addBillTo(doc, docData.to, docData.date, y);
  y = addSectionTitle(doc, docData.subject, y);
  const { finalY } = addItemsTable(doc, docData.items, y, true);

  const pageW = doc.internal.pageSize.getWidth();
  y = finalY + 4;

  if (stampDataUrl) {
    doc.addImage(stampDataUrl, "PNG", pageW - 80 + (80 - M - 18) / 2, y, 18, 18);
  }

  y += 20;
  doc.setDrawColor(...MGRAY);
  doc.line(pageW - 80, y, pageW - M, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...DARK);
  doc.text("Approved by",   pageW - 80, y + 5);
  doc.text(COMPANY.name,    pageW - 80, y + 10);
  doc.text(`Date: ${format(new Date(docData.date), "d MMMM yyyy")}`, pageW - 80, y + 15);

  addFooter(doc);
  return doc.output("arraybuffer");
}

export function generatePaymentVoucher(docData, logoDataUrl, stampDataUrl, signatureDataUrl) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  let y = addHeader(doc, "Payment Voucher", docData.docNo, docData.date, logoDataUrl);

  // Paid To + Date row
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BLACK);
  doc.text("Paid To:", M, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  doc.text(`Date: ${format(new Date(docData.date), "d MMMM yyyy")}`, pageW - M, y, { align: "right" });
  y += 6;

  // Payee info box
  const payeeLines = [
    docData.paidTo?.name || "(Not specified)",
    docData.paidTo?.bank      ? `Bank: ${docData.paidTo.bank}`              : null,
    docData.paidTo?.accountNo ? `Account No: ${docData.paidTo.accountNo}`   : null,
  ].filter(line => line !== null);
  const boxH = 8 + payeeLines.length * 5;
  doc.setFillColor(...LGRAY);
  doc.roundedRect(M, y - 2, pageW - M * 2, boxH, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BLACK);
  doc.text(payeeLines[0], M + 4, y + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...DARK);
  payeeLines.slice(1).forEach((line, i) => {
    doc.text(line, M + 4, y + 5 + (i + 1) * 5);
  });
  y += boxH + 8;

  // Payment table
  autoTable(doc, {
    startY: y,
    head: [["Description / Purpose", "Amount (RM)"]],
    body: [[
      docData.purpose || "",
      { content: rm(docData.amount), styles: { halign: "right", fontStyle: "bold" } },
    ]],
    foot: [[
      { content: "Total Paid", styles: { halign: "right", fontStyle: "bold", fillColor: [...MGRAY], textColor: [...BLACK] } },
      { content: rm(docData.amount), styles: { halign: "right", fontStyle: "bold", fillColor: [...MGRAY], textColor: [...BLACK] } },
    ]],
    showFoot: "lastPage",
    styles:     { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: TEAL, textColor: 255, fontStyle: "bold" },
    bodyStyles: { fillColor: [255, 255, 255] },
    columnStyles: { 1: { cellWidth: 45, halign: "right" } },
    margin: { left: M, right: M },
  });
  y = doc.lastAutoTable.finalY + 8;

  if (docData.reference?.trim()) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(`Transfer Reference: ${docData.reference}`, M, y);
    y += 8;
  }

  if (docData.notes?.trim()) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(`Notes: ${docData.notes}`, M, y);
    y += 8;
  }

  // Signature — company side only
  const pageH = doc.internal.pageSize.getHeight();
  if (y + 45 > pageH - 15) { doc.addPage(); y = 20; }

  const sigStart = pageW - 80;
  const rightEnd = pageW - M;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...BLACK);
  doc.text("Prepared by:", sigStart, y);

  if (stampDataUrl) {
    const stampSize = 18;
    const stampX = sigStart + (rightEnd - sigStart - stampSize) / 2;
    doc.addImage(stampDataUrl, "PNG", stampX, y + 2, stampSize, stampSize);
  }

  y += 22;
  doc.setDrawColor(...MGRAY);
  doc.setLineWidth(0.4);
  doc.line(sigStart, y, rightEnd, y);
  y += 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY);
  doc.text("Signature & Stamp", sigStart, y);
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...BLACK);
  doc.text(COMPANY.name, sigStart, y);
  y += 4;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...DARK);
  doc.text(`Date: ${format(new Date(docData.date), "d MMMM yyyy")}`, sigStart, y);

  addFooter(doc);
  return doc.output("arraybuffer");
}

export function generateCreditNote(docData, logoDataUrl, stampDataUrl, signatureDataUrl) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.__taxRate = Number(docData.taxRate) || 0;
  const pageW = doc.internal.pageSize.getWidth();

  let y = addHeader(doc, "Credit Note", docData.docNo, docData.date, logoDataUrl);

  if (docData.subject?.trim()) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(`Related Invoice: ${docData.subject.trim()}`, pageW - M, y, { align: "right" });
    y += 6;
  }

  y = addBillTo(doc, docData.to, docData.date, y);
  const { finalY } = addItemsTable(doc, docData.items, y, true);
  y = finalY + 10;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text("This credit note reduces the outstanding balance on the related invoice.", M, y);
  y += 8;

  if (docData.notes?.trim()) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...DARK);
    doc.text(`Notes: ${docData.notes}`, M, y);
    y += 8;
  }

  addSignature(doc, y + 5, "invoice", stampDataUrl, docData.date, signatureDataUrl);
  addFooter(doc);
  return doc.output("arraybuffer");
}

export function generateReceipt(docData, logoDataUrl, stampDataUrl, signatureDataUrl) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  let y = addHeader(doc, "Receipt", docData.docNo, docData.date, logoDataUrl);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BLACK);
  doc.text("Received from:", M, y);
  doc.text(`Date: ${format(new Date(docData.date), "d MMMM yyyy")}`, pageW - M, y, { align: "right" });
  y += 6;

  doc.setFillColor(...LGRAY);
  doc.roundedRect(M, y - 2, pageW - M * 2, 12, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BLACK);
  doc.text(docData.client || "(Not specified)", M + 4, y + 5);
  y += 18;

  const desc = docData.invoiceRef?.trim()
    ? `Payment for Invoice ${docData.invoiceRef}`
    : (docData.purpose?.trim() || "Payment Received");

  autoTable(doc, {
    startY: y,
    head: [["Description", "Amount (RM)"]],
    body: [[
      desc,
      { content: rm(docData.amount), styles: { halign: "right", fontStyle: "bold" } },
    ]],
    foot: [[
      { content: "Total Received", styles: { halign: "right", fontStyle: "bold", fillColor: [...MGRAY], textColor: [...BLACK] } },
      { content: rm(docData.amount), styles: { halign: "right", fontStyle: "bold", fillColor: [...MGRAY], textColor: [...BLACK] } },
    ]],
    showFoot: "lastPage",
    styles:     { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: TEAL, textColor: 255, fontStyle: "bold" },
    bodyStyles: { fillColor: [255, 255, 255] },
    columnStyles: { 1: { cellWidth: 45, halign: "right" } },
    margin: { left: M, right: M },
  });
  y = doc.lastAutoTable.finalY + 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...DARK);
  if (docData.paymentMethod) { doc.text(`Payment Method: ${docData.paymentMethod}`, M, y); y += 5; }
  if (docData.invoiceRef?.trim()) { doc.text(`Invoice Reference: ${docData.invoiceRef}`, M, y); y += 5; }
  if (docData.reference?.trim()) { doc.text(`Transfer Reference: ${docData.reference}`, M, y); y += 5; }
  y += 3;

  if (docData.notes?.trim()) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...DARK);
    doc.text(`Notes: ${docData.notes}`, M, y);
    y += 6;
  }

  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text("Thank you for your payment.", M, y);
  y += 8;

  addSignature(doc, y + 5, "invoice", stampDataUrl, docData.date, signatureDataUrl);
  addFooter(doc);
  return doc.output("arraybuffer");
}

export function generateDO(docData, logoDataUrl, stampDataUrl, signatureDataUrl) {
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

  if (stampDataUrl) {
    doc.addImage(stampDataUrl, "PNG", pageW - 80 + (80 - M - 18) / 2, y, 18, 18);
  }

  doc.setDrawColor(...MGRAY);
  doc.line(M,          y + 20, 90,        y + 20);
  doc.line(pageW - 80, y + 20, pageW - M, y + 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text("Name / Signature / Date", M,          y + 25);
  doc.setTextColor(...DARK);
  doc.text("Delivered by",            pageW - 80, y + 25);
  doc.text(COMPANY.name,              pageW - 80, y + 30);
  doc.text(`Date: ${format(new Date(docData.date), "d MMMM yyyy")}`, pageW - 80, y + 35);

  addFooter(doc);
  return doc.output("arraybuffer");
}
