import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import DocForm from "../components/DocForm";
import DocList from "./DocList";
import { getConfig } from "../utils/storage";
import { getToken, getNextDocNumber, appendRow, ensureDriveFolder, uploadPDF, ensureRawColumn, ensureSheetExists, ensureSupplierInvoiceCol, ensureDepositBalanceCol, ensureSheetHasHeaders } from "../utils/google";
import { showToast } from "../utils/toast";

export default function DocPage({ title, prefix, sheetName, showPrice, showTax, showValidUntil, partyLabel, generateFn }) {
  const [docNo, setDocNo] = useState("");
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState("form");
  const [logoUrl, setLogoUrl] = useState(null);
  const [stampUrl, setStampUrl] = useState(null);
  const [signatureUrl, setSignatureUrl] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = location.state?.prefill || null;

  useEffect(() => {
    async function init() {
      const { sheetId, logoDataUrl, stampDataUrl, signatureDataUrl } = getConfig();
      const token = getToken();
      if (logoDataUrl) setLogoUrl(logoDataUrl);
      if (stampDataUrl) setStampUrl(stampDataUrl);
      if (signatureDataUrl) setSignatureUrl(signatureDataUrl);
      if (!sheetId || !token) { navigate("/login"); return; }
      ensureSheetExists(sheetId, sheetName, token); // fire-and-forget — creates sheet tab if missing
      ensureRawColumn(sheetId, token); // fire-and-forget — adds _raw header to existing sheets
      await ensureSheetHasHeaders(sheetId, sheetName, token);
      // Chain sequentially — PP migration must run after SI so column positions are correct
      if (sheetName === "PO") {
        ensureSupplierInvoiceCol(sheetId, token).then(() => ensureDepositBalanceCol(sheetId, sheetName, token));
      } else if (sheetName === "Invoice") {
        ensureDepositBalanceCol(sheetId, sheetName, token);
      }
      try {
        const no = await getNextDocNumber(sheetId, sheetName, prefix, token);
        setDocNo(no);
      } catch (e) {
        console.error(e);
        if (e.httpStatus === 401) navigate("/login");
      }
    }
    init();
  }, []);

  async function handleSave(formData) {
    const action = formData._action;
    const token = getToken();
    const { sheetId, driveFolderId } = getConfig();

    const pdfBytes = generateFn(formData, logoUrl, stampUrl, signatureUrl);

    if (action === "preview") {
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      return;
    }

    setSaving(true);
    try {
      const rootId = driveFolderId;
      const typeFolderId = await ensureDriveFolder(sheetName, rootId, token);
      const folderId = await ensureDriveFolder(formData.to.name || "Unknown", typeFolderId, token);

      const filename = `${formData.docNo} - ${formData.to.name || "Unknown"}.pdf`;
      const driveLink = await uploadPDF(pdfBytes, filename, folderId, token) || "";

      const subtotal = formData.items.reduce((s, i) => s + Number(i.qty || 0) * Number(i.unitPrice || 0), 0);
      const tax = subtotal * (Number(formData.taxRate) / 100);
      const total = subtotal + tax;
      const itemsSummary = formData.items.map((i) => i.description).join(", ");

      // eslint-disable-next-line no-unused-vars
      const { _action, ...saveData } = formData;
      const rawJson = JSON.stringify(saveData);

      const row = sheetName === "DO"
        ? [formData.docNo, formData.date, formData.to.name, itemsSummary,
           formData.items.reduce((s, i) => s + Number(i.qty || 0), 0),
           "Pending", driveLink, formData.notes, rawJson]
        : sheetName === "PO"
        ? [formData.docNo, formData.date, formData.to.name, itemsSummary,
           subtotal.toFixed(2), tax.toFixed(2), total.toFixed(2),
           "Pending", driveLink, formData.notes, "", "", "", rawJson]  // SI + Deposit Proof + Balance Proof
        : sheetName === "Invoice"
        ? [formData.docNo, formData.date, formData.to.name, itemsSummary,
           subtotal.toFixed(2), tax.toFixed(2), total.toFixed(2),
           "Pending", driveLink, formData.notes, "", "", rawJson]      // Deposit Proof + Balance Proof
        : [formData.docNo, formData.date, formData.to.name, itemsSummary,
           subtotal.toFixed(2), tax.toFixed(2), total.toFixed(2),
           "Pending", driveLink, formData.notes, rawJson];

      await appendRow(sheetId, sheetName, row, token);
      localStorage.setItem(`dzanex_doc_${formData.docNo}`, rawJson); // local cache too

      showToast(`${title} saved — ${formData.docNo}`);
      navigate("/");
    } catch (e) {
      console.error(e);
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
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        <button
          onClick={() => setView("form")}
          className={`text-sm font-medium px-4 py-2.5 border-b-2 -mb-px transition-colors whitespace-nowrap ${view === "form" ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          New {title}
        </button>
        <button
          onClick={() => setView("list")}
          className={`text-sm font-medium px-4 py-2.5 border-b-2 -mb-px transition-colors whitespace-nowrap ${view === "list" ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          All {title}s
        </button>
      </div>

      {view === "form" ? (
        docNo ? (
          <DocForm
            key={docNo}
            title={title}
            docNo={docNo}
            showPrice={showPrice}
            showTax={showTax}
            showValidUntil={showValidUntil}
            partyLabel={partyLabel}
            onSave={handleSave}
            saving={saving}
            initialData={prefill}
          />
        ) : (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading…</div>
        )
      ) : (
        <DocList sheetName={sheetName} title={title} />
      )}
    </div>
  );
}
