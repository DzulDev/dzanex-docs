import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import DocForm from "../components/DocForm";
import DocList from "./DocList";
import { getConfig } from "../utils/storage";
import { getToken, getNextDocNumber, appendRow, ensureDriveFolder, uploadPDF, ensureRawColumn, ensureSheetExists } from "../utils/google";

export default function DocPage({ title, prefix, sheetName, showPrice, showTax, showValidUntil, partyLabel, generateFn }) {
  const [docNo, setDocNo] = useState("");
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState("form");
  const [logoUrl, setLogoUrl] = useState(null);
  const [stampUrl, setStampUrl] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = location.state?.prefill || null;

  useEffect(() => {
    async function init() {
      const { sheetId, logoDataUrl, stampDataUrl } = getConfig();
      const token = getToken();
      if (logoDataUrl) setLogoUrl(logoDataUrl);
      if (stampDataUrl) setStampUrl(stampDataUrl);
      if (!sheetId || !token) { navigate("/login"); return; }
      ensureSheetExists(sheetId, sheetName, token); // fire-and-forget — creates sheet tab if missing
      ensureRawColumn(sheetId, token); // fire-and-forget — adds _raw header to existing sheets
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

    const pdfBytes = generateFn(formData, logoUrl, stampUrl);

    if (action === "preview") {
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      return;
    }

    setSaving(true);
    try {
      const rootId = driveFolderId;
      const folderId = await ensureDriveFolder(sheetName, rootId, token);

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
        : [formData.docNo, formData.date, formData.to.name, itemsSummary,
           subtotal.toFixed(2), tax.toFixed(2), total.toFixed(2),
           "Pending", driveLink, formData.notes, rawJson];

      await appendRow(sheetId, sheetName, row, token);
      localStorage.setItem(`dzanex_doc_${formData.docNo}`, rawJson); // local cache too

      alert(`${title} saved!\n${formData.docNo}\nDrive link: ${driveLink}`);
      navigate("/");
    } catch (e) {
      console.error(e);
      if (e.httpStatus === 401) {
        alert("Session expired. Please sign in again.");
        navigate("/login");
      } else {
        alert(`Error saving document: ${e.message}`);
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
