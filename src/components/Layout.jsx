import { NavLink, useNavigate } from "react-router-dom";
import {
  FileText, Receipt, ShoppingCart, Truck,
  LayoutDashboard, Settings, LogOut, Menu, Wallet, BarChart2, ClipboardList,
  FileMinus, FileCheck, HelpCircle, X
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { signOut } from "../utils/google";
import { version } from "../../package.json";

const NAV = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/quotation", icon: FileText, label: "Quotation" },
  { to: "/invoice", icon: Receipt, label: "Invoice" },
  { to: "/po", icon: ShoppingCart, label: "Purchase Order" },
  { to: "/do", icon: Truck, label: "Delivery Order" },
  { to: "/pv", icon: Wallet, label: "Payment Voucher" },
  { to: "/cn",      icon: FileMinus,    label: "Credit Note" },
  { to: "/receipt", icon: FileCheck,    label: "Receipt" },
  { to: "/cashflow", icon: BarChart2,    label: "Cash Flow" },
  { to: "/reports",  icon: ClipboardList, label: "Reports" },
  { to: "/settings", icon: Settings,     label: "Settings" },
];

const UPDATE_CHECK_INTERVAL = 60_000; // check every 60s
const AUTO_REFRESH_DELAY    = 20_000; // auto-refresh after 20s if not dismissed

export default function Layout({ children }) {
  const [open, setOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const autoRefreshTimer = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    let currentBuildTime = null;

    async function checkForUpdate() {
      try {
        const res  = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
        const data = await res.json();
        if (currentBuildTime === null) { currentBuildTime = data.buildTime; return; }
        if (data.buildTime !== currentBuildTime) setUpdateReady(true);
      } catch { /* offline — skip */ }
    }

    checkForUpdate(); // baseline on mount
    const interval = setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!updateReady) return;
    autoRefreshTimer.current = setTimeout(() => window.location.reload(), AUTO_REFRESH_DELAY);
    return () => clearTimeout(autoRefreshTimer.current);
  }, [updateReady]);

  function handleSignOut() {
    signOut();
    navigate("/login");
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-60 bg-[#1B3A5C] text-white flex flex-col
        transform transition-transform duration-200
        ${open ? "translate-x-0" : "-translate-x-full"}
        lg:relative lg:translate-x-0
      `}>
        {/* Logo + company */}
        <div className="px-5 py-5 border-b border-white/10 flex items-center gap-3">
          <img src="/logo.png" alt="Dzanex" className="w-10 h-10 object-contain shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-[#57A9A9] tracking-wide leading-tight">DZANEX TECHNOLOGY</p>
            <p className="text-[11px] text-[#E8917A]/80 mt-0.5 font-medium">TR0320764-P</p>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                ${isActive
                  ? "bg-[#57A9A9] text-white shadow-sm"
                  : "text-white/60 hover:bg-white/8 hover:text-white"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={17} className={isActive ? "text-white" : "text-[#57A9A9]/70"} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Sign out + Help */}
        <div className="p-4 border-t border-white/10 flex items-center justify-between">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 text-sm text-[#E8917A]/70 hover:text-[#E8917A] transition-colors"
          >
            <LogOut size={15} />
            Sign out
          </button>
          <button
            onClick={() => setShowHelp(true)}
            title="Document Flow Guide"
            className="text-white/40 hover:text-white/80 transition-colors"
          >
            <HelpCircle size={16} />
          </button>
        </div>
      </aside>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 lg:hidden">
          <button onClick={() => setOpen(true)} className="text-gray-600">
            <Menu size={20} />
          </button>
          <span className="font-semibold text-gray-800">Dzanex Docs</span>
        </header>
        {/* Update banner */}
        {updateReady && (
          <div className="shrink-0 bg-[#57A9A9] text-white text-xs px-4 py-2 flex items-center justify-between gap-3">
            <span>🔄 New update available!</span>
            <div className="flex items-center gap-2">
              <span className="opacity-75">Auto-refresh in 20s…</span>
              <button
                onClick={() => { clearTimeout(autoRefreshTimer.current); window.location.reload(); }}
                className="bg-white text-[#1B3A5C] font-semibold px-3 py-0.5 rounded-full hover:bg-gray-100 transition-colors"
              >
                Refresh now
              </button>
            </div>
          </div>
        )}
        <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {children}
        </main>

        {/* Help modal */}
        {showHelp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setShowHelp(false)}>
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div>
                  <h2 className="font-bold text-gray-800">Document Flow Guide</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Which document to use and when</p>
                </div>
                <button onClick={() => setShowHelp(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X size={18} />
                </button>
              </div>

              {/* Modal body */}
              <div className="overflow-y-auto px-6 py-5 space-y-6 text-sm">

                {/* Quick decision */}
                <div>
                  <h3 className="font-semibold text-[#1B3A5C] mb-3">Quick Decision</h3>
                  <div className="bg-gray-50 rounded-xl divide-y divide-gray-100 text-xs">
                    {[
                      ["Sending price to client?",             "Quotation (QT)"],
                      ["Client agreed, request payment?",      "Invoice (INV)"],
                      ["Delivering goods to client?",          "Delivery Order (DO)"],
                      ["Buying from formal supplier?",         "Purchase Order (PO)"],
                      ["Buying from Shopee / hardware shop?",  "Payment Voucher (PV) — direct, no PO"],
                      ["Client paid, they need proof?",        "Receipt (REC) — auto on Invoice → Paid"],
                      ["Invoice was wrong / giving refund?",   "Credit Note (CN)"],
                    ].map(([q, a]) => (
                      <div key={q} className="flex justify-between gap-4 px-4 py-2.5">
                        <span className="text-gray-500">{q}</span>
                        <span className="font-semibold text-gray-800 shrink-0">{a}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Main client flow */}
                <div>
                  <h3 className="font-semibold text-[#1B3A5C] mb-3">Main Client Flow</h3>
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    {["Quotation (QT)", "→", "Invoice (INV)", "→", "Delivery Order (DO)"].map((s, i) => (
                      s === "→"
                        ? <span key={i} className="text-gray-300 font-bold">→</span>
                        : <span key={i} className="bg-[#1B3A5C] text-white text-xs font-medium px-3 py-1 rounded-full">{s}</span>
                    ))}
                  </div>
                  <ul className="text-xs text-gray-500 space-y-1.5 ml-1">
                    <li><span className="font-semibold text-gray-700">QT</span> — Send before any work. Client approves or rejects.</li>
                    <li><span className="font-semibold text-gray-700">INV</span> — Send after client agrees. Requesting payment.</li>
                    <li><span className="font-semibold text-gray-700">DO</span> — When delivering goods. Client signs to confirm receipt.</li>
                    <li className="text-gray-400">Not every job needs all three. Small jobs can go straight to INV.</li>
                  </ul>
                </div>

                {/* Payment flow */}
                <div>
                  <h3 className="font-semibold text-[#1B3A5C] mb-3">Payment Flow — Invoice → Receipt</h3>
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    {["Invoice (Pending)", "→", "Mark as Paid", "→", "Popup", "→", "Receipt (REC) auto-created"].map((s, i) => (
                      s === "→"
                        ? <span key={i} className="text-gray-300 font-bold">→</span>
                        : <span key={i} className={`text-xs font-medium px-3 py-1 rounded-full ${s.includes("auto") ? "bg-[#57A9A9] text-white" : "bg-[#1B3A5C] text-white"}`}>{s}</span>
                    ))}
                  </div>
                  <ul className="text-xs text-gray-500 space-y-1.5 ml-1">
                    <li>Receipt number follows invoice — INV-2025-017 → <span className="font-mono font-semibold text-gray-700">REC-2025-017</span></li>
                    <li>PDF auto-generated and saved to Google Drive + Sheets</li>
                    <li>Click <span className="font-semibold text-gray-700">Skip</span> in the popup if no receipt needed</li>
                  </ul>
                </div>

                {/* Supplier flow */}
                <div>
                  <h3 className="font-semibold text-[#1B3A5C] mb-3">Supplier / Expense Flow</h3>
                  <div className="space-y-3">
                    <div className="bg-gray-50 rounded-xl p-3 text-xs">
                      <p className="font-semibold text-gray-700 mb-1">Formal supplier (sends goods based on PO)</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {["PO", "→", "Goods received", "→", "PV via Convert"].map((s, i) => (
                          s === "→"
                            ? <span key={i} className="text-gray-300">→</span>
                            : <span key={i} className="bg-[#1B3A5C] text-white px-2.5 py-0.5 rounded-full font-medium">{s}</span>
                        ))}
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 text-xs">
                      <p className="font-semibold text-gray-700 mb-1">Shopee / hardware shop (direct cash purchase)</p>
                      <div className="flex items-center gap-2">
                        <span className="bg-[#1B3A5C] text-white px-2.5 py-0.5 rounded-full font-medium">PV directly</span>
                        <span className="text-gray-400">— no PO needed</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Credit note */}
                <div>
                  <h3 className="font-semibold text-[#1B3A5C] mb-2">Credit Note — When to Use</h3>
                  <p className="text-xs text-gray-500 mb-2">Only when something goes wrong with an invoice:</p>
                  <ul className="text-xs text-gray-500 space-y-1 ml-1 list-disc list-inside">
                    <li>Client returns goods → CN reduces what they owe</li>
                    <li>Invoice had wrong amount → CN corrects it</li>
                    <li>Giving a discount after invoice was sent</li>
                  </ul>
                  <p className="text-xs text-[#E8917A] mt-2 font-medium">Credit Note ≠ Receipt. They are opposites. Rarely issue both for same invoice.</p>
                </div>

                {/* Reports */}
                <div>
                  <h3 className="font-semibold text-[#1B3A5C] mb-3">Reports</h3>
                  <div className="bg-gray-50 rounded-xl divide-y divide-gray-100 text-xs">
                    {[
                      ["Statement", "All docs per client — billed, paid, balance due"],
                      ["Aging",     "Unpaid invoices by days overdue (0–30, 31–60, 61–90, 90+)"],
                      ["P&L",       "Monthly revenue vs expenses = gross profit"],
                      ["Sales",     "All clients ranked by total billed & collected"],
                    ].map(([tab, desc]) => (
                      <div key={tab} className="flex gap-4 px-4 py-2.5">
                        <span className="font-semibold text-gray-700 w-20 shrink-0">{tab}</span>
                        <span className="text-gray-500">{desc}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-2 ml-1">Cash Flow page — only counts rows with Status = Paid.</p>
                </div>

                {/* Convert buttons */}
                <div>
                  <h3 className="font-semibold text-[#1B3A5C] mb-3">Convert Shortcuts</h3>
                  <p className="text-xs text-gray-400 mb-2">Available in each document list under the Convert button. Auto-fills info from the source doc.</p>
                  <div className="bg-gray-50 rounded-xl divide-y divide-gray-100 text-xs">
                    {[
                      ["Quotation",  "→ Invoice",               "Client info + all items carried over"],
                      ["Quotation",  "→ Delivery Order",        "Client info + all items carried over"],
                      ["Invoice",    "→ Delivery Order",        "Client info + all items carried over"],
                      ["Invoice",    "→ Issue Receipt",         "Client name, amount, invoice ref auto-filled"],
                      ["Invoice",    "→ Issue Credit Note",     "Client info + items + invoice ref as subject"],
                      ["PO",         "→ Issue Payment Voucher", "Supplier name, total amount, PO ref auto-filled"],
                    ].map(([from, to, note]) => (
                      <div key={from + to} className="px-4 py-2.5">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-gray-700">{from}</span>
                          <span className="text-[#57A9A9] font-medium">{to}</span>
                        </div>
                        <span className="text-gray-400">{note}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Status meanings */}
                <div>
                  <h3 className="font-semibold text-[#1B3A5C] mb-3">Status Meanings</h3>
                  <div className="bg-gray-50 rounded-xl divide-y divide-gray-100 text-xs">
                    {[
                      ["Pending",   "Not yet paid / not yet actioned"],
                      ["Paid",      "Money received (Invoice) or money sent (PV)"],
                      ["Overdue",   "Invoice past due, still unpaid — shows as alert on Dashboard"],
                      ["Accepted",  "Client agreed to the Quotation"],
                      ["Rejected",  "Client rejected the Quotation"],
                      ["Received",  "Goods received from supplier (PO)"],
                      ["Delivered", "Goods delivered to client (DO)"],
                      ["Cancelled", "Cancelled, ignored in all reports"],
                      ["Issued",    "Receipt has been issued"],
                      ["Applied",   "Credit Note has been used/applied by client"],
                      ["Voided",    "Credit Note is void — no longer valid"],
                    ].map(([status, desc]) => (
                      <div key={status} className="flex gap-4 px-4 py-2.5">
                        <span className="font-semibold text-gray-700 w-20 shrink-0">{status}</span>
                        <span className="text-gray-500">{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Dashboard */}
                <div>
                  <h3 className="font-semibold text-[#1B3A5C] mb-3">Dashboard</h3>
                  <div className="bg-gray-50 rounded-xl divide-y divide-gray-100 text-xs">
                    {[
                      ["Summary cards",    "Total docs, amount to collect (pending + overdue invoices), paid this month"],
                      ["Action alerts",    "Clickable banners for overdue invoices, unpaid invoices, pending QTs, pending DOs — sorted by urgency"],
                      ["Status breakdown", "Count per status for each doc type. Click any card to go to that list"],
                      ["Recent docs",      "Last 5 documents across all types, sorted by date"],
                    ].map(([item, desc]) => (
                      <div key={item} className="px-4 py-2.5">
                        <p className="font-semibold text-gray-700 mb-0.5">{item}</p>
                        <p className="text-gray-500">{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* PDF & Drive */}
                <div>
                  <h3 className="font-semibold text-[#1B3A5C] mb-3">PDF & Google Drive</h3>
                  <ul className="text-xs text-gray-500 space-y-1.5 ml-1">
                    <li>Every saved document generates a PDF and uploads it to <span className="font-semibold text-gray-700">Google Drive</span> automatically.</li>
                    <li>PDFs are stored in folders: <span className="font-mono text-gray-700">Dzanex Docs / Quotation / Invoice / PO / DO / PV / Receipt / CreditNote</span></li>
                    <li>Click <span className="font-semibold text-gray-700">Open PDF</span> (or <span className="font-semibold text-gray-700">Open</span> on desktop) in the document list to view the file in Google Drive.</li>
                    <li>Use <span className="font-semibold text-gray-700">Preview PDF</span> button on the form to preview before saving.</li>
                    <li>All data is also saved to <span className="font-semibold text-gray-700">Google Sheets</span> — one tab per document type.</li>
                  </ul>
                </div>

                {/* Delete */}
                <div>
                  <h3 className="font-semibold text-[#1B3A5C] mb-3">Deleting a Document</h3>
                  <ul className="text-xs text-gray-500 space-y-1.5 ml-1">
                    <li>Click the <span className="font-semibold text-gray-700">trash icon</span> on any row in the document list.</li>
                    <li>Confirm with <span className="font-semibold text-gray-700">Yes</span> — this removes the row from Google Sheets AND deletes the PDF from Google Drive.</li>
                    <li className="text-[#E8917A] font-medium">This cannot be undone.</li>
                  </ul>
                </div>

                {/* Items table tips */}
                <div>
                  <h3 className="font-semibold text-[#1B3A5C] mb-3">Items Table Tips</h3>
                  <div className="bg-gray-50 rounded-xl divide-y divide-gray-100 text-xs">
                    {[
                      ["Notes field",   "Sub-descriptions under an item. Each line becomes a bullet point (•) in the PDF."],
                      ["l/s unit",      "Set Unit to \"l/s\" (lump sum) — PDF shows \"l/s\" instead of \"1 l/s\" in Quantity column."],
                      ["Bold header",   "Tick the Bold checkbox on an item to make it a bold section header in the PDF."],
                      ["Tax rate",      "Set once per document — applies to the full subtotal. 0% if no tax."],
                      ["Valid Until",   "Quotation only — expiry date shown on the PDF to the client."],
                    ].map(([tip, desc]) => (
                      <div key={tip} className="px-4 py-2.5">
                        <p className="font-semibold text-gray-700 mb-0.5">{tip}</p>
                        <p className="text-gray-500">{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Settings */}
                <div>
                  <h3 className="font-semibold text-[#1B3A5C] mb-3">Settings</h3>
                  <div className="bg-gray-50 rounded-xl divide-y divide-gray-100 text-xs">
                    {[
                      ["Logo",          "Upload company logo — appears on all PDF headers."],
                      ["Stamp",         "Upload company stamp/seal — appears on signature section of PDFs."],
                      ["Google Sheet",  "The Sheet ID where all records are saved. Pre-configured, no need to change."],
                      ["Terms",         "Default terms & conditions for Quotation PDFs. Enable/disable per line."],
                      ["Payment Terms", "Default payment terms text shown on Quotation PDF (e.g. \"50% deposit required\")."],
                    ].map(([item, desc]) => (
                      <div key={item} className="px-4 py-2.5">
                        <p className="font-semibold text-gray-700 mb-0.5">{item}</p>
                        <p className="text-gray-500">{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}
        <footer className="shrink-0 border-t border-gray-100 bg-white px-4 py-2 flex items-center justify-between text-xs text-gray-400">
          <span>© 2025 Dzanex Technology</span>
          <span>v{version}</span>
        </footer>
      </div>
    </div>
  );
}
