import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Loader2, Save, Eye } from "lucide-react";
import DocList from "./DocList";
import { getConfig } from "../utils/storage";
import {
  getToken, getNextDocNumber, appendRow,
  ensureDriveFolder, uploadPDF, ensureSheetExists,
} from "../utils/google";
import { generateReceipt } from "../utils/pdf";
import { showToast } from "../utils/toast";

const PAYMENT_METHODS = ["Bank Transfer", "Cash", "Cheque", "Online Transfer", "Credit Card", "Other"];

export default function ReceiptPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const fromState = location.state?.prefill;

  const [docNo, setDocNo]       = useState("");
  const [saving, setSaving]     = useState(false);
  const [view, setView]         = useState("form");
  const [logoUrl, setLogoUrl]   = useState(null);
  const [stampUrl, setStampUrl] = useState(null);
  const [form, setForm] = useState({
    date:          new Date().toISOString().split("T")[0],
    client:        fromState?.client    || "",
    amount:        fromState?.amount    || "",
    paymentMethod: "Bank Transfer",
    invoiceRef:    fromState?.invoiceRef || "",
    reference:     "",
    purpose:       "",
    notes:         "",
  });

  useEffect(() => {
    async function init() {
      const { sheetId, logoDataUrl, stampDataUrl } = getConfig();
      const token = getToken();
      if (logoDataUrl)  setLogoUrl(logoDataUrl);
      if (stampDataUrl) setStampUrl(stampDataUrl);
      if (!sheetId || !token) { navigate("/login"); return; }
      try {
        await ensureSheetExists(sheetId, "Receipt", token);
        const no = await getNextDocNumber(sheetId, "Receipt", "REC", token);
        setDocNo(no);
      } catch (e) {
        if (e.httpStatus === 401) navigate("/login");
      }
    }
    init();
  }, []);

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSave(action) {
    const token = getToken();
    const { sheetId, driveFolderId } = getConfig();
    const docData = { ...form, docNo };
    const pdfBytes = generateReceipt(docData, logoUrl, stampUrl);

    if (action === "preview") {
      window.open(URL.createObjectURL(new Blob([pdfBytes], { type: "application/pdf" })), "_blank");
      return;
    }

    setSaving(true);
    try {
      const folderId  = await ensureDriveFolder("Receipt", driveFolderId, token);
      const filename  = `${docNo} - ${form.client || "Unknown"}.pdf`;
      const driveLink = await uploadPDF(pdfBytes, filename, folderId, token) || "";
      const rawJson   = JSON.stringify(docData);

      await appendRow(sheetId, "Receipt", [
        docNo, form.date, form.client,
        parseFloat(form.amount || 0).toFixed(2),
        form.paymentMethod, form.invoiceRef,
        "Issued", driveLink, form.notes, rawJson,
      ], token);

      localStorage.setItem(`dzanex_doc_${docNo}`, rawJson);
      showToast(`Receipt saved — ${docNo}`);
      navigate("/");
    } catch (e) {
      if (e.httpStatus === 401) {
        showToast("Session expired. Please sign in again.", "error");
        navigate("/login");
      } else {
        showToast(`Error saving document: ${e.message}`, "error");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        <button
          onClick={() => setView("form")}
          className={`text-sm font-medium px-4 py-2.5 border-b-2 -mb-px transition-colors whitespace-nowrap
            ${view === "form" ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          New Receipt
        </button>
        <button
          onClick={() => setView("list")}
          className={`text-sm font-medium px-4 py-2.5 border-b-2 -mb-px transition-colors whitespace-nowrap
            ${view === "list" ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          All Receipts
        </button>
      </div>

      {view === "form" ? (
        docNo ? (
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h1 className="text-xl font-bold text-gray-800">Receipt</h1>
              <div className="flex gap-2">
                <button
                  type="button" disabled={saving}
                  onClick={() => handleSave("preview")}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <Eye size={15} />
                  Preview PDF
                </button>
                <button
                  type="button" disabled={saving}
                  onClick={() => handleSave("save")}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-700 text-white text-sm font-medium hover:bg-blue-800 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  {saving ? "Saving…" : "Save & Upload"}
                </button>
              </div>
            </div>

            {/* Doc Info */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 grid grid-cols-2 gap-4">
              <div>
                <label className="label">Doc No</label>
                <input className="input font-mono" value={docNo} readOnly />
              </div>
              <div>
                <label className="label">Date</label>
                <input type="date" className="input" value={form.date}
                  onChange={e => set("date", e.target.value)} />
              </div>
            </div>

            {/* Received From */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-700 mb-4">Received From</h2>
              <div>
                <label className="label">Client Name *</label>
                <input className="input" placeholder="Client or company name"
                  value={form.client} onChange={e => set("client", e.target.value)} />
              </div>
            </div>

            {/* Payment Details */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-700 mb-4">Payment Details</h2>
              <div className="space-y-4">
                <div>
                  <label className="label">Amount Received (RM) *</label>
                  <input type="number" className="input" min={0} step={0.01} placeholder="0.00"
                    value={form.amount} onChange={e => set("amount", e.target.value)} />
                </div>
                <div>
                  <label className="label">Payment Method</label>
                  <select className="input" value={form.paymentMethod}
                    onChange={e => set("paymentMethod", e.target.value)}>
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">
                    Invoice Reference{" "}
                    <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input className="input" placeholder="e.g. INV-2025-001"
                    value={form.invoiceRef} onChange={e => set("invoiceRef", e.target.value)} />
                </div>
                <div>
                  <label className="label">
                    Purpose / Description{" "}
                    <span className="text-gray-400 font-normal">(if no invoice ref)</span>
                  </label>
                  <input className="input" placeholder="e.g. IT Support Services"
                    value={form.purpose} onChange={e => set("purpose", e.target.value)} />
                </div>
                <div>
                  <label className="label">
                    Transfer Reference{" "}
                    <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input className="input" placeholder="e.g. TRF20250522001"
                    value={form.reference} onChange={e => set("reference", e.target.value)} />
                </div>
                <div>
                  <label className="label">Notes</label>
                  <textarea className="input" rows={2} placeholder="Any additional notes…"
                    value={form.notes} onChange={e => set("notes", e.target.value)} />
                </div>
              </div>
            </div>

            {/* Total display */}
            {form.amount && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 flex justify-between items-center">
                <span className="font-semibold text-gray-700">Total Received</span>
                <span className="text-xl font-bold text-green-600">
                  MYR {parseFloat(form.amount || 0).toFixed(2)}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading…</div>
        )
      ) : (
        <DocList sheetName="Receipt" title="Receipt" />
      )}
    </div>
  );
}
