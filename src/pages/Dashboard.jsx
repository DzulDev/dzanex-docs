import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Receipt, ShoppingCart, Truck, RefreshCw, TrendingUp, Wallet } from "lucide-react";
import { getConfig } from "../utils/storage";
import { getRows, getToken } from "../utils/google";

const DOC_TYPES = [
  { key: "Quotation", label: "Quotation",       icon: FileText,     path: "/quotation", statuses: ["Pending", "Accepted", "Rejected"] },
  { key: "Invoice",   label: "Invoice",          icon: Receipt,      path: "/invoice",   statuses: ["Pending", "Paid", "Overdue"] },
  { key: "PO",        label: "Purchase Order",   icon: ShoppingCart, path: "/po",        statuses: ["Pending", "Received", "Cancelled"] },
  { key: "DO",        label: "Delivery Order",   icon: Truck,        path: "/do",        statuses: ["Pending", "Delivered", "Cancelled"] },
  { key: "PV",        label: "Payment Voucher",  icon: Wallet,       path: "/pv",        statuses: ["Pending", "Paid", "Cancelled"] },
];

const STATUS_DOT = {
  Pending:   "bg-yellow-400",
  Accepted:  "bg-green-500",
  Paid:      "bg-green-500",
  Received:  "bg-blue-500",
  Delivered: "bg-blue-500",
  Rejected:  "bg-red-400",
  Overdue:   "bg-orange-400",
  Cancelled: "bg-gray-300",
};

const STATUS_TEXT = {
  Pending:   "text-yellow-700",
  Accepted:  "text-green-700",
  Paid:      "text-green-700",
  Received:  "text-blue-700",
  Delivered: "text-blue-700",
  Rejected:  "text-red-600",
  Overdue:   "text-orange-600",
  Cancelled: "text-gray-400",
};

function fmtDate(d) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  const mon = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${parseInt(day)} ${mon[parseInt(m) - 1]} ${y}`;
}

function fmtMYR(n) {
  return `MYR ${Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

export default function Dashboard() {
  const [allData, setAllData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    const { sheetId } = getConfig();
    const token = getToken();
    if (!sheetId || !token) { setLoading(false); return; }
    try {
      const [qt, inv, po, doRows, pv] = await Promise.all([
        getRows(sheetId, "Quotation", token),
        getRows(sheetId, "Invoice",   token),
        getRows(sheetId, "PO",        token),
        getRows(sheetId, "DO",        token),
        getRows(sheetId, "PV",        token),
      ]);
      setAllData({ Quotation: qt, Invoice: inv, PO: po, DO: doRows, PV: pv });
    } catch (e) {
      console.error(e);
      if (e.httpStatus === 401) navigate("/login");
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-60 text-gray-400 text-sm">Loading…</div>
  );
  if (!allData) return null;

  // Status counts per doc type
  function statusCounts(rows) {
    return rows.reduce((acc, r) => {
      const s = r.Status || "Pending";
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});
  }
  const counts = {
    Quotation: statusCounts(allData.Quotation),
    Invoice:   statusCounts(allData.Invoice),
    PO:        statusCounts(allData.PO),
    DO:        statusCounts(allData.DO),
    PV:        statusCounts(allData.PV),
  };

  // Financial metrics
  const now             = new Date();
  const monthPrefix     = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const pendingINVValue = allData.Invoice.filter(r => !r.Status || r.Status === "Pending").reduce((s, r) => s + (parseFloat(r.Total) || 0), 0);
  const overdueINVValue = allData.Invoice.filter(r => r.Status === "Overdue").reduce((s, r) => s + (parseFloat(r.Total) || 0), 0);
  const toCollect       = pendingINVValue + overdueINVValue;

  const paidThisMonth   = allData.Invoice
    .filter(r => r.Status === "Paid" && (r.Date || "").startsWith(monthPrefix))
    .reduce((s, r) => s + (parseFloat(r.Total) || 0), 0);

  const spentThisMonth  = [
    ...allData.PO.filter(r => r.Status === "Paid" && (r.Date || "").startsWith(monthPrefix)).map(r => parseFloat(r.Total)  || 0),
    ...allData.PV.filter(r => r.Status === "Paid" && (r.Date || "").startsWith(monthPrefix)).map(r => parseFloat(r.Amount) || 0),
  ].reduce((s, n) => s + n, 0);

  const netThisMonth    = paidThisMonth - spentThisMonth;

  // Pending action alerts
  const pendingQT  = counts.Quotation.Pending || 0;
  const pendingINV = counts.Invoice.Pending   || 0;
  const overdueINV = counts.Invoice.Overdue   || 0;
  const pendingDO  = counts.DO.Pending        || 0;
  const pendingPV  = (allData.PV || []).filter(r => r.Status === "Pending").length;
  const pendingPVAmt = (allData.PV || []).filter(r => r.Status === "Pending").reduce((s, r) => s + (parseFloat(r.Amount) || 0), 0);

  // Paid invoices that have a matching DO still on Pending (by sequence: INV-2025-017 ↔ DO-2025-017)
  const paidInvSeqs = new Set(
    allData.Invoice
      .filter(r => r.Status === "Paid")
      .map(r => { const p = (r["Doc No"] || "").split("-"); return p.length >= 3 ? `${p[1]}-${p[2]}` : null; })
      .filter(Boolean)
  );
  const paidPendingDO = allData.DO.filter(r => {
    if (r.Status !== "Pending") return false;
    const p = (r["Doc No"] || "").split("-");
    return p.length >= 3 && paidInvSeqs.has(`${p[1]}-${p[2]}`);
  });

  const alerts = [
    overdueINV       > 0 && { dot: "bg-red-400",    style: "bg-red-50 border-red-200 text-red-700",         path: "/invoice",   msg: `${overdueINV} overdue invoice${overdueINV > 1 ? "s" : ""} — ${fmtMYR(overdueINVValue)}` },
    pendingINV       > 0 && { dot: "bg-orange-400", style: "bg-orange-50 border-orange-200 text-orange-700", path: "/invoice",   msg: `${pendingINV} invoice${pendingINV > 1 ? "s" : ""} unpaid — ${fmtMYR(pendingINVValue)}` },
    paidPendingDO.length > 0 && { dot: "bg-[#57A9A9]",  style: "bg-teal-50 border-teal-200 text-teal-700",  path: "/do",        msg: `${paidPendingDO.length} paid invoice${paidPendingDO.length > 1 ? "s" : ""} — delivery still pending` },
    pendingPV        > 0 && { dot: "bg-purple-400", style: "bg-purple-50 border-purple-200 text-purple-700", path: "/pv",        msg: `${pendingPV} payment voucher${pendingPV > 1 ? "s" : ""} unpaid — ${fmtMYR(pendingPVAmt)}` },
    pendingQT        > 0 && { dot: "bg-yellow-400", style: "bg-yellow-50 border-yellow-200 text-yellow-700", path: "/quotation", msg: `${pendingQT} quotation${pendingQT > 1 ? "s" : ""} awaiting client response` },
    pendingDO        > 0 && { dot: "bg-blue-500",   style: "bg-blue-50 border-blue-200 text-blue-700",       path: "/do",        msg: `${pendingDO} delivery order${pendingDO > 1 ? "s" : ""} pending` },
  ].filter(Boolean);

  // Recent 5 documents across all types
  const recent = [
    ...allData.Quotation.map(r => ({ ...r, _type: "QT",  _party: r.Client,   _amt: r.Total })),
    ...allData.Invoice.map(r =>   ({ ...r, _type: "INV", _party: r.Client,   _amt: r.Total })),
    ...allData.PO.map(r =>        ({ ...r, _type: "PO",  _party: r.Supplier, _amt: r.Total })),
    ...allData.DO.map(r =>        ({ ...r, _type: "DO",  _party: r.Client,   _amt: null })),
    ...allData.PV.map(r =>        ({ ...r, _type: "PV",  _party: r["Paid To"], _amt: r.Amount })),
  ].sort((a, b) => new Date(b.Date) - new Date(a.Date)).slice(0, 5);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-xs text-gray-400 mt-0.5">Dzanex Technology</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Financial summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-[11px] text-gray-400 mb-1">To Collect</p>
          <p className="text-sm font-bold text-orange-600 leading-tight">{fmtMYR(toCollect)}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{pendingINV + overdueINV} unpaid invoice{pendingINV + overdueINV !== 1 ? "s" : ""}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-[11px] text-gray-400 mb-1">Income (Month)</p>
          <p className="text-sm font-bold text-green-600 leading-tight">{fmtMYR(paidThisMonth)}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">paid invoices</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-[11px] text-gray-400 mb-1">Expenses (Month)</p>
          <p className="text-sm font-bold text-red-500 leading-tight">{fmtMYR(spentThisMonth)}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">paid PO + PV</p>
        </div>
        <div className={`rounded-xl border p-4 ${netThisMonth >= 0 ? "bg-[#57A9A9]/5 border-[#57A9A9]/30" : "bg-red-50 border-red-200"}`}>
          <p className="text-[11px] text-gray-400 mb-1">Net (Month)</p>
          <p className={`text-sm font-bold leading-tight ${netThisMonth >= 0 ? "text-[#57A9A9]" : "text-red-500"}`}>{fmtMYR(netThisMonth)}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{netThisMonth >= 0 ? "net positive" : "net negative"}</p>
        </div>
      </div>

      {/* Action alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <button
              key={i}
              onClick={() => navigate(a.path)}
              className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-opacity hover:opacity-80 ${a.style}`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${a.dot}`} />
              {a.msg}
            </button>
          ))}
        </div>
      )}

      {/* Status breakdown — one card per doc type */}
      <div className="grid grid-cols-2 gap-3">
        {DOC_TYPES.map(({ key, label, icon: Icon, path, statuses }, idx) => {
          const total = (allData[key] || []).length;
          return (
            <button
              key={key}
              onClick={() => navigate(path)}
              className={`bg-white rounded-xl border border-gray-200 p-4 text-left hover:shadow-md transition-shadow ${idx === 4 ? "col-span-2" : ""}`}
            >
              {/* Doc type header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Icon size={14} className="text-[#57A9A9] shrink-0" />
                  <span className="text-xs font-semibold text-gray-600">{label}</span>
                </div>
                <span className="text-xl font-bold text-gray-800">{total}</span>
              </div>

              {/* Status rows */}
              <div className="space-y-1.5">
                {statuses.map(s => {
                  const n = counts[key]?.[s] || 0;
                  return (
                    <div key={s} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${n > 0 ? STATUS_DOT[s] : "bg-gray-200"}`} />
                        <span className={`text-xs ${n > 0 ? STATUS_TEXT[s] : "text-gray-300"}`}>{s}</span>
                      </div>
                      <span className={`text-xs font-semibold tabular-nums ${n > 0 ? STATUS_TEXT[s] : "text-gray-300"}`}>{n}</span>
                    </div>
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>

      {/* Recent documents */}
      {recent.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <TrendingUp size={14} className="text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">Recent Documents</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {recent.map((r, i) => (
              <div key={i} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-xs text-blue-700 font-semibold">{r["Doc No"]}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">{r._type}</span>
                  </div>
                  <p className="text-xs text-gray-400 truncate">{r._party || "—"} · {fmtDate(r.Date)}</p>
                </div>
                <div className="text-right shrink-0">
                  {r._amt ? <p className="text-xs font-semibold text-gray-700">MYR {r._amt}</p> : null}
                  <div className="flex items-center gap-1 justify-end mt-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[r.Status || "Pending"]}`} />
                    <span className={`text-[10px] ${STATUS_TEXT[r.Status || "Pending"]}`}>{r.Status || "Pending"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
