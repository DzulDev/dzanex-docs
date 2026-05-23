import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getConfig } from "../utils/storage";
import { getRows, updateCell, getToken, getSheetGid, deleteSheetRow, deleteDriveFile, appendRow, ensureDriveFolder, uploadPDF, ensureSheetExists, uploadFile } from "../utils/google";
import { generateReceipt, generateDO } from "../utils/pdf";
import { showToast } from "../utils/toast";
import { ChevronDown, ExternalLink, FileText, Loader2, Paperclip, RefreshCw, Trash2, Receipt } from "lucide-react";

const PAYMENT_METHODS = ["Bank Transfer", "Cash", "Cheque", "Online Transfer", "Credit Card", "Other"];

const STATUS_OPTIONS = {
  Quotation:  ["Pending", "Accepted", "Rejected"],
  Invoice:    ["Pending", "Paid", "Overdue"],
  PO:         ["Pending", "Received", "Cancelled"],
  DO:         ["Pending", "Delivered", "Cancelled"],
  PV:         ["Pending", "Paid", "Cancelled"],
  CreditNote: ["Pending", "Applied", "Voided"],
  Receipt:    ["Issued", "Voided"],
};

const STATUS_COL = {
  Quotation:  "H",
  Invoice:    "H",
  PO:         "H",
  DO:         "F",
  PV:         "F",
  CreditNote: "H",
  Receipt:    "G",
};

function invoiceToReceiptPrefill(prefill, row) {
  return {
    _type: "receipt",
    client:    prefill?.to?.name || row["Client"] || "",
    amount:    row["Total"] || "",
    invoiceRef: row["Doc No"] || "",
  };
}

function invoiceToCNPrefill(prefill, row) {
  if (!prefill) return null;
  return { ...prefill, subject: row["Doc No"] || prefill.docNo || "" };
}

function poToPVPrefill(prefill, row) {
  return {
    _type: "pv",
    paidTo:    { name: prefill?.to?.name || row["Supplier"] || "", bank: "", accountNo: "" },
    amount:    row["Total"] || "",
    purpose:   `Payment for ${row["Doc No"]}`,
    reference: "",
    notes:     "",
  };
}

// Column letters stay in sync with HEADERS in google.js
const SUPPLIER_INV_COL  = "K"; // PO: index 10
const PAYMENT_PROOF_COL = { PO: "L", Invoice: "K" }; // PO: index 11, Invoice: index 10

const CONVERT_OPTIONS = {
  Quotation: [
    { label: "Invoice",           path: "/invoice" },
    { label: "Delivery Order",    path: "/do" },
  ],
  Invoice: [
    { label: "Delivery Order",    path: "/do" },
    { label: "Issue Receipt",     path: "/receipt", transform: invoiceToReceiptPrefill },
    { label: "Issue Credit Note", path: "/cn",      transform: invoiceToCNPrefill },
  ],
  PO: [
    { label: "Issue Payment Voucher", path: "/pv",  transform: poToPVPrefill },
  ],
};

const STATUS_STYLE = {
  Pending:   "bg-yellow-50 text-yellow-700 border-yellow-200",
  Accepted:  "bg-green-50  text-green-700  border-green-200",
  Paid:      "bg-green-50  text-green-700  border-green-200",
  Applied:   "bg-green-50  text-green-700  border-green-200",
  Received:  "bg-blue-50   text-blue-700   border-blue-200",
  Delivered: "bg-blue-50   text-blue-700   border-blue-200",
  Issued:    "bg-blue-50   text-blue-700   border-blue-200",
  Rejected:  "bg-red-50    text-red-600    border-red-200",
  Overdue:   "bg-orange-50 text-orange-600 border-orange-200",
  Cancelled: "bg-gray-50   text-gray-500   border-gray-200",
  Voided:    "bg-gray-50   text-gray-500   border-gray-200",
};

const STATUS_DOT = {
  Pending:   "bg-yellow-400",
  Accepted:  "bg-green-500",
  Paid:      "bg-green-500",
  Applied:   "bg-green-500",
  Received:  "bg-blue-500",
  Delivered: "bg-blue-500",
  Issued:    "bg-blue-500",
  Rejected:  "bg-red-400",
  Overdue:   "bg-orange-400",
  Cancelled: "bg-gray-300",
  Voided:    "bg-gray-300",
};

async function autoCreateReceipt(row, paymentMethod, reference, date) {
  const { sheetId, driveFolderId, logoDataUrl, stampDataUrl } = getConfig();
  const token = getToken();
  if (!sheetId || !token) return;

  const prefill = getPrefill(row);
  const invoiceDocNo = prefill?.docNo || row["Doc No"] || "";
  const parts = invoiceDocNo.split("-");
  if (parts.length < 3) return;
  const receiptDocNo = `REC-${parts[1]}-${parts[2]}`;

  const today   = date || (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();
  const client  = prefill?.to?.name || row["Client"] || "";
  const amount  = prefill?.items?.reduce((s, i) => s + Number(i.qty||0)*Number(i.unitPrice||0), 0)?.toFixed(2) || row["Total"] || "0.00";

  const docData = {
    docNo: receiptDocNo, date: today, client, amount,
    paymentMethod: paymentMethod || "Bank Transfer",
    invoiceRef: invoiceDocNo,
    purpose: "", reference: reference || "", notes: "",
  };

  try {
    await ensureSheetExists(sheetId, "Receipt", token);
    const pdfBytes  = generateReceipt(docData, logoDataUrl || null, stampDataUrl || null);
    const folderId  = await ensureDriveFolder("Receipt", driveFolderId, token);
    const filename  = `${receiptDocNo} - ${client || "Unknown"}.pdf`;
    const driveLink = await uploadPDF(pdfBytes, filename, folderId, token) || "";
    const rawJson   = JSON.stringify(docData);
    await appendRow(sheetId, "Receipt", [
      receiptDocNo, today, client,
      parseFloat(amount || 0).toFixed(2),
      paymentMethod || "Bank Transfer", invoiceDocNo,
      "Issued", driveLink, "", rawJson,
    ], token);
    showToast(`Receipt created — ${receiptDocNo}`, "info");
  } catch (e) {
    console.error("Auto-create receipt failed:", e);
    showToast("Receipt could not be created. Try manually.", "error");
  }
}

async function autoCreateDO(row, date) {
  const { sheetId, driveFolderId, logoDataUrl, stampDataUrl } = getConfig();
  const token = getToken();
  if (!sheetId || !token) return;

  const prefill = getPrefill(row);
  const invoiceDocNo = prefill?.docNo || row["Doc No"] || "";
  const parts = invoiceDocNo.split("-");
  if (parts.length < 3) return;
  const doDocNo = `DO-${parts[1]}-${parts[2]}`;
  const today   = date || (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();
  const client  = prefill?.to?.name || row["Client"] || "";
  const items   = prefill?.items || [{ description: row["Items"] || "", qty: 1, unit: "unit", notes: "" }];

  const docData = {
    docNo: doDocNo, date: today,
    to: prefill?.to || { name: client },
    items, subject: prefill?.subject || "", notes: prefill?.notes || "",
  };

  try {
    await ensureSheetExists(sheetId, "DO", token);
    const pdfBytes    = generateDO(docData, logoDataUrl || null, stampDataUrl || null);
    const folderId    = await ensureDriveFolder("DO", driveFolderId, token);
    const filename    = `${doDocNo} - ${client || "Unknown"}.pdf`;
    const driveLink   = await uploadPDF(pdfBytes, filename, folderId, token) || "";
    const itemsSummary = items.map(i => i.description).join(", ");
    const totalQty     = items.reduce((s, i) => s + (Number(i.qty) || 0), 0);
    const rawJson      = JSON.stringify(docData);
    await appendRow(sheetId, "DO", [
      doDocNo, today, client, itemsSummary,
      totalQty, "Pending", driveLink, docData.notes, rawJson,
    ], token);
    showToast(`Delivery Order created — ${doDocNo}`, "info");
  } catch (e) {
    console.error("Auto-create DO failed:", e);
    showToast("Delivery Order could not be created. Try manually.", "error");
  }
}

function getPrefill(row) {
  if (row["_raw"]) {
    try { return JSON.parse(row["_raw"]); } catch { /* ignore */ }
  }
  try { return JSON.parse(localStorage.getItem(`dzanex_doc_${row["Doc No"]}`) || "null"); }
  catch { return null; }
}

function fmtDate(d) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  const mon = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${parseInt(day)} ${mon[parseInt(m) - 1]} ${y}`;
}

export default function DocList({ sheetName, title }) {
  const [rows, setRows]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [updating, setUpdating] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const [openStatus,    setOpenStatus]    = useState(null);
  const [statusPos,     setStatusPos]     = useState(null);
  const [openConvert,   setOpenConvert]   = useState(null);
  const [convertPos,    setConvertPos]    = useState(null);
  const [receiptPrompt, setReceiptPrompt] = useState(null);
  const [uploading, setUploading] = useState(null);

  const navigate = useNavigate();
  const convertOptions = CONVERT_OPTIONS[sheetName] || [];

  function closeAll() { setOpenStatus(null); setOpenConvert(null); }

  async function load() {
    setLoading(true);
    try {
      const { sheetId } = getConfig();
      const token = getToken();
      if (!sheetId || !token) return;
      const data = await getRows(sheetId, sheetName, token);
      setRows(data.reverse());
    } catch (e) {
      console.error(e);
      if (e.httpStatus === 401) navigate("/login");
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [sheetName]);

  async function handleStatusChange(row, newStatus) {
    const { sheetId } = getConfig();
    const token = getToken();
    const col = STATUS_COL[sheetName];
    if (!col || !sheetId || !token) return;
    closeAll();
    setUpdating(row._rowNum);
    try {
      await updateCell(sheetId, sheetName, row._rowNum, col, newStatus, token);
      setRows(prev => prev.map(r => r._rowNum === row._rowNum ? { ...r, Status: newStatus } : r));
      const _docNo = getPrefill(row)?.docNo || row["Doc No"] || "Doc";
      showToast(`${_docNo} → ${newStatus}`);
      if (sheetName === "Invoice" && newStatus === "Paid") {
        const localDate = new Date();
        const dateStr = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, "0")}-${String(localDate.getDate()).padStart(2, "0")}`;
        setReceiptPrompt({ row, paymentMethod: "Bank Transfer", reference: "", date: dateStr, createDO: false });
      }
    } catch (e) {
      console.error(e);
      showToast("Status update failed — check connection.", "error");
    } finally {
      setUpdating(null);
    }
  }

  async function handleDelete(row) {
    const { sheetId } = getConfig();
    const token = getToken();
    if (!sheetId || !token) return;
    setConfirmDelete(null);
    setDeleting(row._rowNum);
    try {
      const gid = await getSheetGid(sheetId, sheetName, token);
      await deleteSheetRow(sheetId, gid, row._rowNum, token);
      await deleteDriveFile(row["Drive Link"], token);
      // Reload so all _rowNum values stay accurate
      await load();
    } catch (e) {
      console.error(e);
      if (e.httpStatus === 401) navigate("/login");
      else alert(`Delete failed: ${e.message}`);
    } finally {
      setDeleting(null);
    }
  }

  function handleConvert(row, opt) {
    const prefill = getPrefill(row);
    const transformed = opt.transform ? opt.transform(prefill, row) : prefill;
    closeAll();
    navigate(opt.path, { state: { prefill: transformed } });
  }

  // Generic attachment uploader — field is the sheet column header, col is the letter, label is display text
  async function handleAttachUpload(row, file, field, col, label) {
    const { sheetId, driveFolderId } = getConfig();
    const token = getToken();
    if (!sheetId || !token || !file) return;
    setUploading(`${row._rowNum}-${field}`);
    try {
      const folderId = await ensureDriveFolder(sheetName, driveFolderId, token);
      const bytes = await file.arrayBuffer();
      const party = row["Client"] || row["Supplier"] || "Unknown";
      const filename = `[${label}] ${row["Doc No"]} - ${party}.pdf`;
      const link = await uploadFile(bytes, filename, file.type || "application/pdf", folderId, token);
      await updateCell(sheetId, sheetName, row._rowNum, col, link, token);
      setRows(prev => prev.map(r => r._rowNum === row._rowNum ? { ...r, [field]: link } : r));
      showToast(`${label} uploaded`);
    } catch (e) {
      console.error(e);
      showToast("Upload failed — " + e.message, "error");
    } finally {
      setUploading(null);
    }
  }

  function toggleStatus(e, row) {
    if (openStatus === row._rowNum) { closeAll(); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    setOpenConvert(null);
    setStatusPos({ top: rect.bottom + 4, left: rect.left });
    setOpenStatus(row._rowNum);
  }

  function toggleConvert(e, row) {
    if (openConvert === row._rowNum) { closeAll(); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    setOpenStatus(null);
    setConvertPos({ top: rect.bottom + 4, left: Math.max(4, rect.right - 180) });
    setOpenConvert(row._rowNum);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading…</div>
  );

  const headers = rows[0]
    ? Object.keys(rows[0]).filter(h => h !== "Drive Link" && h !== "Supplier Invoice" && h !== "Payment Proof" && !h.startsWith("_"))
    : [];

  const activeStatusRow  = rows.find(r => r._rowNum === openStatus);
  const activeConvertRow = rows.find(r => r._rowNum === openConvert);

  // Shared status badge button used in both card and table views
  function StatusBadge({ row }) {
    const status = row["Status"] || "Pending";
    return (
      <button
        disabled={updating === row._rowNum}
        onClick={e => toggleStatus(e, row)}
        className={`inline-flex items-center gap-1.5 text-xs font-medium pl-2 pr-2 py-1 rounded-full border transition-all whitespace-nowrap
          ${STATUS_STYLE[status] || "bg-gray-50 text-gray-500 border-gray-200"}
          ${updating === row._rowNum ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:shadow-sm"}`}
      >
        {updating === row._rowNum
          ? <Loader2 size={9} className="animate-spin" />
          : <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[status] || "bg-gray-300"}`} />
        }
        {status}
        <ChevronDown size={10} className={`transition-transform ${openStatus === row._rowNum ? "rotate-180" : ""}`} />
      </button>
    );
  }

  return (
    <div>
      {/* Receipt auto-create prompt */}
      {receiptPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-full bg-[#57A9A9]/10 flex items-center justify-center shrink-0">
                <Receipt size={16} className="text-[#57A9A9]" />
              </div>
              <h3 className="font-semibold text-gray-800">Create Receipt?</h3>
            </div>
            <p className="text-xs text-gray-400 mb-5 ml-12">
              Auto-generate receipt for <span className="font-mono font-semibold text-blue-700">{getPrefill(receiptPrompt.row)?.docNo || receiptPrompt.row["Doc No"] || "this invoice"}</span>
            </p>

            <div className="space-y-3">
              <div>
                <label className="label">Payment Date</label>
                <input
                  type="date"
                  className="input"
                  value={receiptPrompt.date}
                  onChange={e => setReceiptPrompt(p => ({ ...p, date: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Payment Method</label>
                <select
                  className="input"
                  value={receiptPrompt.paymentMethod}
                  onChange={e => setReceiptPrompt(p => ({ ...p, paymentMethod: e.target.value }))}
                >
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="label">
                  Transfer Reference{" "}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  className="input"
                  placeholder="e.g. TRF20250522001"
                  value={receiptPrompt.reference}
                  onChange={e => setReceiptPrompt(p => ({ ...p, reference: e.target.value }))}
                />
              </div>
              <div className="border border-gray-200 rounded-xl p-3 space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={receiptPrompt.createDO}
                    onChange={e => setReceiptPrompt(p => ({ ...p, createDO: e.target.checked }))}
                    className="w-4 h-4 rounded accent-[#1B3A5C] shrink-0"
                  />
                  <span className="text-xs font-semibold text-gray-700">Also create Delivery Order (DO)</span>
                </label>
                <div className="text-[11px] text-gray-400 ml-7 space-y-1">
                  <p><span className="font-semibold text-gray-500">Tick</span> — DO not yet created in the system. Need to create one now.</p>
                  <p><span className="font-semibold text-gray-500">Untick</span> — DO already exists, or service job (no delivery).</p>
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setReceiptPrompt(null)}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  autoCreateReceipt(receiptPrompt.row, receiptPrompt.paymentMethod, receiptPrompt.reference, receiptPrompt.date);
                  if (receiptPrompt.createDO) autoCreateDO(receiptPrompt.row, receiptPrompt.date);
                  setReceiptPrompt(null);
                }}
                className="flex-1 px-4 py-2 rounded-lg bg-[#1B3A5C] text-white text-sm font-medium hover:bg-[#1B3A5C]/90 transition-colors"
              >
                Create Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backdrop */}
      {(openStatus !== null || openConvert !== null) && (
        <div className="fixed inset-0 z-40" onClick={closeAll} />
      )}

      {/* Status dropdown — fixed, escapes overflow clipping */}
      {openStatus !== null && statusPos && activeStatusRow && (
        <div
          style={{ position: "fixed", top: statusPos.top, left: statusPos.left, zIndex: 50 }}
          className="bg-white border border-gray-200 rounded-xl shadow-xl py-1 min-w-36"
        >
          {(STATUS_OPTIONS[sheetName] || ["Pending"]).map(s => (
            <button
              key={s}
              onClick={() => handleStatusChange(activeStatusRow, s)}
              className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2.5 transition-colors
                ${s === (activeStatusRow.Status || "Pending")
                  ? "bg-gray-50 font-semibold text-gray-800"
                  : "text-gray-600 hover:bg-gray-50"}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[s] || "bg-gray-300"}`} />
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Convert dropdown — fixed, escapes overflow clipping */}
      {openConvert !== null && convertPos && activeConvertRow && (
        <div
          style={{ position: "fixed", top: convertPos.top, left: convertPos.left, zIndex: 50 }}
          className="bg-white border border-gray-200 rounded-xl shadow-xl py-1 w-44"
        >
          <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Convert to</p>
          {convertOptions.map(opt => (
            <button
              key={opt.path}
              onClick={() => handleConvert(activeConvertRow, opt)}
              className="w-full text-left px-3 py-2.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors"
            >
              <FileText size={13} className="text-[#57A9A9] shrink-0" />
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h2 className="font-semibold text-gray-700">All {title}s ({rows.length})</h2>
        <button onClick={load} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 shrink-0">
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-12 text-center text-gray-400 text-sm">
          No records yet.
        </div>
      ) : (
        <>
          {/* ── Mobile card view (hidden on md+) ─────────────────────────── */}
          <div className="md:hidden space-y-3">
            {rows.map((row, i) => {
              const party  = row["Client"] || row["Supplier"] || row["Paid To"] || "";
              const amount = row["Total"]     ? `MYR ${row["Total"]}`
                           : row["Total Qty"] ? `Qty: ${row["Total Qty"]}`
                           : row["Amount"]    ? `MYR ${row["Amount"]}`
                           : "";
              const items  = row["Items"] || "";
              const truncated = items.length > 50 ? items.slice(0, 50) + "…" : items;

              return (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
                  {/* Doc No + Status */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-sm font-semibold text-blue-700">{row["Doc No"]}</span>
                    <StatusBadge row={row} />
                  </div>

                  {/* Client + Date + Amount */}
                  {party && <p className="text-sm font-medium text-gray-800 mb-0.5">{party}</p>}
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-gray-400">{fmtDate(row["Date"])}</p>
                    {amount && <p className="text-xs font-semibold text-gray-700">{amount}</p>}
                  </div>
                  {truncated && <p className="text-xs text-gray-400 mt-1 leading-relaxed">{truncated}</p>}

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                    {row["Drive Link"] ? (
                      <a
                        href={row["Drive Link"]} target="_blank" rel="noreferrer"
                        className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        <ExternalLink size={12} />
                        Open PDF
                      </a>
                    ) : (
                      <div className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg border border-gray-100 text-gray-300">
                        No PDF
                      </div>
                    )}
                    {sheetName === "PO" && (
                      row["Supplier Invoice"] ? (
                        <a href={row["Supplier Invoice"]} target="_blank" rel="noreferrer"
                          className="inline-flex items-center justify-center gap-1 text-xs font-medium py-2 px-2.5 rounded-lg border border-orange-200 text-orange-600 hover:bg-orange-50 transition-colors"
                          title="View supplier invoice">
                          <Paperclip size={11} /> SI
                        </a>
                      ) : (
                        <label className={`inline-flex items-center justify-center gap-1 text-xs py-2 px-2.5 rounded-lg border border-dashed border-gray-300 text-gray-400 hover:border-orange-300 hover:text-orange-500 transition-colors cursor-pointer ${uploading ? "opacity-50 pointer-events-none" : ""}`} title="Attach supplier invoice">
                          <input type="file" accept=".pdf,application/pdf,image/*" className="hidden"
                            onChange={e => { if (e.target.files?.[0]) handleAttachUpload(row, e.target.files[0], "Supplier Invoice", SUPPLIER_INV_COL, "Supplier Invoice"); e.target.value = ""; }} />
                          {uploading === `${row._rowNum}-Supplier Invoice` ? <Loader2 size={11} className="animate-spin" /> : <Paperclip size={11} />}
                        </label>
                      )
                    )}
                    {(sheetName === "PO" || sheetName === "Invoice") && (
                      row["Payment Proof"] ? (
                        <a href={row["Payment Proof"]} target="_blank" rel="noreferrer"
                          className="inline-flex items-center justify-center gap-1 text-xs font-medium py-2 px-2.5 rounded-lg border border-green-200 text-green-600 hover:bg-green-50 transition-colors"
                          title="View payment proof">
                          <Paperclip size={11} /> PP
                        </a>
                      ) : (
                        <label className={`inline-flex items-center justify-center gap-1 text-xs py-2 px-2.5 rounded-lg border border-dashed border-gray-300 text-gray-400 hover:border-green-300 hover:text-green-500 transition-colors cursor-pointer ${uploading ? "opacity-50 pointer-events-none" : ""}`} title="Attach payment proof">
                          <input type="file" accept=".pdf,application/pdf,image/*" className="hidden"
                            onChange={e => { if (e.target.files?.[0]) handleAttachUpload(row, e.target.files[0], "Payment Proof", PAYMENT_PROOF_COL[sheetName], "Payment Proof"); e.target.value = ""; }} />
                          {uploading === `${row._rowNum}-Payment Proof` ? <Loader2 size={11} className="animate-spin" /> : <Paperclip size={11} />}
                        </label>
                      )
                    )}
                    {convertOptions.length > 0 && (
                      <button
                        onClick={e => toggleConvert(e, row)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg bg-[#57A9A9]/10 text-[#57A9A9] border border-[#57A9A9]/30 hover:bg-[#57A9A9]/20 transition-colors"
                      >
                        Convert
                        <ChevronDown size={10} className={`transition-transform ${openConvert === row._rowNum ? "rotate-180" : ""}`} />
                      </button>
                    )}
                    {/* Delete */}
                    {confirmDelete === row._rowNum ? (
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleDelete(row)}
                          className="text-xs font-medium text-red-600 border border-red-200 px-2.5 py-2 rounded-lg hover:bg-red-50 transition-colors">
                          Delete
                        </button>
                        <button onClick={() => setConfirmDelete(null)}
                          className="text-xs text-gray-400 border border-gray-200 px-2.5 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        disabled={deleting === row._rowNum}
                        onClick={() => setConfirmDelete(row._rowNum)}
                        className="p-2 rounded-lg border border-gray-200 text-gray-300 hover:text-red-400 hover:border-red-200 transition-colors disabled:opacity-50"
                      >
                        {deleting === row._rowNum
                          ? <Loader2 size={14} className="animate-spin" />
                          : <Trash2 size={14} />
                        }
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Desktop table view (hidden below md) ─────────────────────── */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                  <tr>
                    {headers.map(h => (
                      <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                    ))}
                    <th className="px-4 py-3 text-left">PDF</th>
                    {sheetName === "PO" && <th className="px-4 py-3 text-left">Supplier Inv.</th>}
                    {(sheetName === "PO" || sheetName === "Invoice") && <th className="px-4 py-3 text-left">Payment Proof</th>}
                    {convertOptions.length > 0 && <th className="px-4 py-3 text-left">Convert</th>}
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      {headers.map(h => (
                        <td key={h} className="px-4 py-3 text-gray-700 whitespace-nowrap">
                          {h === "Doc No" ? (
                            <span className="font-mono text-blue-700">{row[h]}</span>
                          ) : h === "Status" ? (
                            <StatusBadge row={row} />
                          ) : (
                            row[h]
                          )}
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        {row["Drive Link"] ? (
                          <a href={row["Drive Link"]} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors">
                            <ExternalLink size={12} />
                            Open
                          </a>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      {sheetName === "PO" && (
                        <td className="px-4 py-3">
                          {row["Supplier Invoice"] ? (
                            <a href={row["Supplier Invoice"]} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 hover:text-orange-800 transition-colors">
                              <Paperclip size={12} /> View
                            </a>
                          ) : (
                            <label className={`inline-flex items-center gap-1 text-xs text-gray-400 hover:text-orange-500 transition-colors cursor-pointer ${uploading ? "opacity-50 pointer-events-none" : ""}`} title="Attach supplier invoice">
                              <input type="file" accept=".pdf,application/pdf,image/*" className="hidden"
                                onChange={e => { if (e.target.files?.[0]) handleAttachUpload(row, e.target.files[0], "Supplier Invoice", SUPPLIER_INV_COL, "Supplier Invoice"); e.target.value = ""; }} />
                              {uploading === `${row._rowNum}-Supplier Invoice` ? <Loader2 size={12} className="animate-spin" /> : <><Paperclip size={12} /> Attach</>}
                            </label>
                          )}
                        </td>
                      )}
                      {(sheetName === "PO" || sheetName === "Invoice") && (
                        <td className="px-4 py-3">
                          {row["Payment Proof"] ? (
                            <a href={row["Payment Proof"]} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-green-600 hover:text-green-800 transition-colors">
                              <Paperclip size={12} /> View
                            </a>
                          ) : (
                            <label className={`inline-flex items-center gap-1 text-xs text-gray-400 hover:text-green-500 transition-colors cursor-pointer ${uploading ? "opacity-50 pointer-events-none" : ""}`} title="Attach payment proof">
                              <input type="file" accept=".pdf,application/pdf,image/*" className="hidden"
                                onChange={e => { if (e.target.files?.[0]) handleAttachUpload(row, e.target.files[0], "Payment Proof", PAYMENT_PROOF_COL[sheetName], "Payment Proof"); e.target.value = ""; }} />
                              {uploading === `${row._rowNum}-Payment Proof` ? <Loader2 size={12} className="animate-spin" /> : <><Paperclip size={12} /> Attach</>}
                            </label>
                          )}
                        </td>
                      )}
                      {convertOptions.length > 0 && (
                        <td className="px-4 py-3">
                          <button
                            onClick={e => toggleConvert(e, row)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[#57A9A9]/10 text-[#57A9A9] hover:bg-[#57A9A9]/20 border border-[#57A9A9]/30 transition-colors whitespace-nowrap"
                          >
                            Convert
                            <ChevronDown size={10} className={`transition-transform ${openConvert === row._rowNum ? "rotate-180" : ""}`} />
                          </button>
                        </td>
                      )}
                      {/* Delete */}
                      <td className="px-4 py-3">
                        {confirmDelete === row._rowNum ? (
                          <div className="flex items-center gap-1.5 whitespace-nowrap">
                            <span className="text-xs text-gray-500">Delete?</span>
                            <button
                              onClick={() => handleDelete(row)}
                              className="text-xs font-medium text-red-600 hover:text-red-800 transition-colors"
                            >Yes</button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                            >No</button>
                          </div>
                        ) : (
                          <button
                            disabled={deleting === row._rowNum}
                            onClick={() => setConfirmDelete(row._rowNum)}
                            className="text-gray-300 hover:text-red-400 transition-colors disabled:opacity-50"
                          >
                            {deleting === row._rowNum
                              ? <Loader2 size={14} className="animate-spin" />
                              : <Trash2 size={14} />
                            }
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
