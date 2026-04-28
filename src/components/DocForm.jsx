import { useState } from "react";
import { format } from "date-fns";
import { Loader2, Save, Eye } from "lucide-react";
import ItemsTable from "./ItemsTable";

const DEFAULT_TERMS = [
  { enabled: true, text: "A deposit must be paid to proceed with purchasing items and project execution." },
  { enabled: true, text: "The balance payment is required to proceed with the delivery of the order." },
  { enabled: true, text: "Goods sold are neither returnable nor refundable." },
  { enabled: true, text: "Any discrepancies must be reported to us within 7 days. Otherwise, goods sold are deemed accepted and confirmed by the customer." },
];

export default function DocForm({
  title,
  docNo,
  showPrice = true,
  showTax = true,
  showValidUntil = false,
  partyLabel = "Client",
  onSave,
  saving,
}) {
  const today = format(new Date(), "yyyy-MM-dd");

  const [form, setForm] = useState({
    docNo,
    date: today,
    validUntil: "",
    taxRate: 0,
    subject: "",
    paymentTerms: "",
    notes: "",
    terms: DEFAULT_TERMS.map(t => ({ ...t })),
    to: { name: "", address: "", contact: "", email: "", attn: "" },
    items: [{ description: "", qty: 1, unit: "unit", unitPrice: 0, notes: "", isBold: false }],
  });

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function setTo(field, value) {
    setForm((f) => ({ ...f, to: { ...f.to, [field]: value } }));
  }

  function handleSave(action) {
    onSave({ ...form, _action: action });
  }

  const subtotal = form.items.reduce(
    (s, i) => s + Number(i.qty || 0) * Number(i.unitPrice || 0),
    0
  );
  const tax = subtotal * (Number(form.taxRate) / 100);
  const total = subtotal + tax;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">{title}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Doc No: <span className="font-mono text-blue-700">{docNo}</span></p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave("preview")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Eye size={15} />
            Preview PDF
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave("save")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-700 text-white text-sm font-medium hover:bg-blue-800 disabled:opacity-50"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {saving ? "Saving…" : "Save & Upload"}
          </button>
        </div>
      </div>

      {/* Doc Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <label className="label">Date</label>
          <input type="date" className="input" value={form.date} onChange={(e) => set("date", e.target.value)} />
        </div>
        {showValidUntil && (
          <div>
            <label className="label">Valid Until</label>
            <input type="date" className="input" value={form.validUntil} onChange={(e) => set("validUntil", e.target.value)} />
          </div>
        )}
        {showTax && (
          <div>
            <label className="label">Tax / SST (%)</label>
            <input type="number" className="input" min={0} max={100} step={0.1}
              value={form.taxRate} onChange={(e) => set("taxRate", e.target.value)} />
          </div>
        )}
      </div>

      {/* Party Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-700 mb-4">{partyLabel} Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Company / Name *</label>
            <input className="input" placeholder={`${partyLabel} name`}
              value={form.to.name} onChange={(e) => setTo("name", e.target.value)} />
          </div>
          <div>
            <label className="label">Contact Person (Attn)</label>
            <input className="input" placeholder="Name"
              value={form.to.attn} onChange={(e) => setTo("attn", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Address</label>
            <textarea className="input" rows={2} placeholder="Full address"
              value={form.to.address} onChange={(e) => setTo("address", e.target.value)} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" placeholder="+60 ..."
              value={form.to.contact} onChange={(e) => setTo("contact", e.target.value)} />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" placeholder="email@company.com"
              value={form.to.email} onChange={(e) => setTo("email", e.target.value)} />
          </div>
        </div>
      </div>

      {/* Subject / Title */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <label className="label">Title / Subject <span className="text-gray-400 font-normal">(shown as heading above items table in PDF)</span></label>
        <input className="input" placeholder="Document title"
          value={form.subject} onChange={(e) => set("subject", e.target.value)} />
      </div>

      {/* Items */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-700 mb-4">Items / Services</h2>
        <ItemsTable items={form.items} onChange={(items) => set("items", items)} showPrice={showPrice} />
      </div>

      {/* Terms & Conditions (Quotation only) */}
      {showValidUntil && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-700 mb-4">Terms &amp; Conditions</h2>
          <div className="space-y-2">
            {form.terms.map((term, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={term.enabled}
                  onChange={(e) => {
                    const terms = form.terms.map((t, idx) => idx === i ? { ...t, enabled: e.target.checked } : t);
                    set("terms", terms);
                  }}
                  className="w-3.5 h-3.5 rounded accent-blue-600 shrink-0 cursor-pointer"
                />
                <input
                  type="text"
                  className={`input text-xs py-1.5 flex-1 transition-opacity ${!term.enabled ? "opacity-40" : ""}`}
                  value={term.text}
                  disabled={!term.enabled}
                  onChange={(e) => {
                    const terms = form.terms.map((t, idx) => idx === i ? { ...t, text: e.target.value } : t);
                    set("terms", terms);
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Totals + Notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <label className="label">Payment Terms</label>
            <input className="input" placeholder="Payment terms"
              value={form.paymentTerms} onChange={(e) => set("paymentTerms", e.target.value)} />
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <label className="label">Notes / Remarks</label>
            <textarea className="input" rows={3} placeholder="Any additional notes…"
              value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </div>
        {showPrice && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span>MYR {subtotal.toFixed(2)}</span>
            </div>
            {Number(form.taxRate) > 0 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>Tax ({form.taxRate}%)</span>
                <span>MYR {tax.toFixed(2)}</span>
              </div>
            )}
            <div className="border-t pt-3 flex justify-between font-bold text-gray-800">
              <span>TOTAL</span>
              <span>MYR {total.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
