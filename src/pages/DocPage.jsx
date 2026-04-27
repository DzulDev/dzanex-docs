import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DocForm from "../components/DocForm";
import DocList from "./DocList";
import { getConfig } from "../utils/storage";
import { getToken, getNextDocNumber, appendRow, ensureDriveFolder, uploadPDF } from "../utils/google";
import { format } from "date-fns";

export default function DocPage({ type, title, prefix, sheetName, showPrice, showTax, showValidUntil, partyLabel, generateFn }) {
  const [docNo, setDocNo] = useState("");
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState("form"); // form | list
  const [logoUrl, setLogoUrl] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function init() {
      const { sheetId, logoDataUrl } = getConfig();
      const token = getToken();
      if (logoDataUrl) setLogoUrl(logoDataUrl);
      if (!sheetId || !token) { navigate("/login"); return; }
      const no = await getNextDocNumber(sheetId, sheetName, prefix, token);
      setDocNo(no);
    }
    init();
  }, []);

  async function handleSave(formData) {
    const action = formData._action;
    const token = getToken();
    const { sheetId, driveFolderId } = getConfig();

    const pdfBytes = generateFn(formData, logoUrl);

    if (action === "preview") {
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      return;
    }

    setSaving(true);
    try {
      // get or create folder
      const rootId = driveFolderId;
      const folderId = await ensureDriveFolder(sheetName, rootId, token);

      const filename = `${formData.docNo} - ${formData.to.name || "Unknown"}.pdf`;
      const driveLink = await uploadPDF(pdfBytes, filename, folderId, token);

      const subtotal = formData.items.reduce((s, i) => s + Number(i.qty || 0) * Number(i.unitPrice || 0), 0);
      const tax = subtotal * (Number(formData.taxRate) / 100);
      const total = subtotal + tax;
      const itemsSummary = formData.items.map((i) => i.description).join(", ");

      const row = sheetName === "DO"
        ? [formData.docNo, formData.date, formData.to.name, itemsSummary,
           formData.items.reduce((s, i) => s + Number(i.qty || 0), 0),
           "Pending", driveLink, formData.notes]
        : [formData.docNo, formData.date, formData.to.name, itemsSummary,
           subtotal.toFixed(2), tax.toFixed(2), total.toFixed(2),
           "Pending", driveLink, formData.notes];

      await appendRow(sheetId, sheetName, row, token);

      alert(`${title} saved!\n${formData.docNo}\nDrive link: ${driveLink}`);
      navigate("/");
    } catch (e) {
      console.error(e);
      alert("Error saving document. Check console.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setView("form")}
          className={`text-sm font-medium pb-1 border-b-2 transition-colors ${view === "form" ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          New {title}
        </button>
        <button
          onClick={() => setView("list")}
          className={`text-sm font-medium pb-1 border-b-2 transition-colors ${view === "list" ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
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
