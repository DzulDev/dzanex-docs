import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, Printer } from "lucide-react";
import { getConfig } from "../utils/storage";
import { getRows, getToken } from "../utils/google";
import { fmtMYR } from "../utils/fmt";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function monthLabel(ym) {
  const [, m] = ym.split("-");
  return MONTHS[parseInt(m) - 1];
}

export default function CashFlow() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear]       = useState(String(new Date().getFullYear()));
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    const { sheetId } = getConfig();
    const token = getToken();
    if (!sheetId || !token) { setLoading(false); return; }
    try {
      const [invRows, poRows, pvRows] = await Promise.all([
        getRows(sheetId, "Invoice", token),
        getRows(sheetId, "PO",      token),
        getRows(sheetId, "PV",      token),
      ]);
      setData({ invRows, poRows, pvRows });
    } catch (e) {
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
  if (!data) return null;

  // Available years from all rows
  const allYears = [...new Set([
    ...data.invRows.map(r => (r.Date || "").slice(0, 4)),
    ...data.poRows.map(r =>  (r.Date || "").slice(0, 4)),
    ...data.pvRows.map(r =>  (r.Date || "").slice(0, 4)),
  ].filter(y => y.length === 4))].sort((a, b) => b - a);

  // Paid rows filtered by selected year
  const paidInv = data.invRows.filter(r => r.Status === "Paid" && (r.Date || "").startsWith(year));
  const paidPO  = data.poRows.filter(r =>  r.Status === "Paid" && (r.Date || "").startsWith(year));
  const paidPV  = data.pvRows.filter(r =>  r.Status === "Paid" && (r.Date || "").startsWith(year));

  const totalIn  = paidInv.reduce((s, r) => s + (parseFloat(r.Total)  || 0), 0);
  const totalOut = [
    ...paidPO.map(r => parseFloat(r.Total)  || 0),
    ...paidPV.map(r => parseFloat(r.Amount) || 0),
  ].reduce((s, n) => s + n, 0);
  const netCash = totalIn - totalOut;

  // Monthly buckets (always show all 12)
  const monthMap = {};
  for (let m = 1; m <= 12; m++) {
    const ym = `${year}-${String(m).padStart(2, "0")}`;
    monthMap[ym] = { in: 0, out: 0 };
  }
  paidInv.forEach(r => {
    const ym = (r.Date || "").slice(0, 7);
    if (monthMap[ym]) monthMap[ym].in += parseFloat(r.Total) || 0;
  });
  paidPO.forEach(r => {
    const ym = (r.Date || "").slice(0, 7);
    if (monthMap[ym]) monthMap[ym].out += parseFloat(r.Total) || 0;
  });
  paidPV.forEach(r => {
    const ym = (r.Date || "").slice(0, 7);
    if (monthMap[ym]) monthMap[ym].out += parseFloat(r.Amount) || 0;
  });

  // Transaction list: all In + Out sorted by date desc
  const transactions = [
    ...paidInv.map(r => ({ date: r.Date, docNo: r["Doc No"], label: r.Client || "—", amount: parseFloat(r.Total) || 0,  type: "in",  source: "Invoice" })),
    ...paidPO.map(r =>  ({ date: r.Date, docNo: r["Doc No"], label: r.Supplier || "—", amount: parseFloat(r.Total) || 0, type: "out", source: "PO" })),
    ...paidPV.map(r =>  ({ date: r.Date, docNo: r["Doc No"], label: r["Paid To"] || "—", amount: parseFloat(r.Amount) || 0, type: "out", source: "PV" })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="space-y-5 print:space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Cash Flow</h1>
          <p className="text-xs text-gray-400 mt-0.5">Income vs Expenses — {year}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={e => setYear(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#57A9A9]"
          >
            {(allYears.length > 0 ? allYears : [String(new Date().getFullYear())]).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
            title="Print"
          >
            <Printer size={15} />
          </button>
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Print title (hidden on screen) */}
      <div className="hidden print:block mb-4">
        <p className="text-lg font-bold text-gray-800">Cash Flow Report — {year}</p>
        <p className="text-xs text-gray-400">Dzanex Technology · TR0320764-P</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-[11px] text-gray-400 mb-1">Money In</p>
          <p className="text-sm font-bold text-green-600 leading-tight">{fmtMYR(totalIn)}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{paidInv.length} paid invoice{paidInv.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-[11px] text-gray-400 mb-1">Money Out</p>
          <p className="text-sm font-bold text-red-500 leading-tight">{fmtMYR(totalOut)}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{paidPO.length + paidPV.length} payment{(paidPO.length + paidPV.length) !== 1 ? "s" : ""}</p>
        </div>
        <div className={`rounded-xl border p-4 ${netCash >= 0 ? "bg-[#57A9A9]/5 border-[#57A9A9]/30" : "bg-red-50 border-red-200"}`}>
          <p className="text-[11px] text-gray-400 mb-1">Net Cash</p>
          <p className={`text-sm font-bold leading-tight ${netCash >= 0 ? "text-[#57A9A9]" : "text-red-500"}`}>{fmtMYR(netCash)}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{netCash >= 0 ? "net positive" : "net negative"}</p>
        </div>
      </div>

      {/* Monthly breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Monthly Breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#1B3A5C] text-white">
                <th className="text-left px-4 py-2.5 font-semibold">Month</th>
                <th className="text-right px-4 py-2.5 font-semibold">Money In</th>
                <th className="text-right px-4 py-2.5 font-semibold">Money Out</th>
                <th className="text-right px-4 py-2.5 font-semibold">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {Object.entries(monthMap).map(([ym, m]) => {
                const net     = m.in - m.out;
                const hasData = m.in > 0 || m.out > 0;
                return (
                  <tr key={ym} className={hasData ? "" : "opacity-30"}>
                    <td className="px-4 py-2.5 text-gray-700">{monthLabel(ym)}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-green-600 tabular-nums">
                      {m.in > 0 ? fmtMYR(m.in) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-red-500 tabular-nums">
                      {m.out > 0 ? fmtMYR(m.out) : "—"}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${
                      !hasData ? "text-gray-300" : net > 0 ? "text-[#57A9A9]" : net < 0 ? "text-red-500" : "text-gray-400"
                    }`}>
                      {hasData ? fmtMYR(net) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t-2 border-gray-200 font-bold">
                <td className="px-4 py-2.5 text-gray-700">Total {year}</td>
                <td className="px-4 py-2.5 text-right text-green-600 tabular-nums">{fmtMYR(totalIn)}</td>
                <td className="px-4 py-2.5 text-right text-red-500 tabular-nums">{fmtMYR(totalOut)}</td>
                <td className={`px-4 py-2.5 text-right tabular-nums ${netCash >= 0 ? "text-[#57A9A9]" : "text-red-500"}`}>{fmtMYR(netCash)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Transactions list */}
      {transactions.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Transactions — {year}</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {transactions.map((tx, i) => (
              <div key={i} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${tx.type === "in" ? "bg-green-500" : "bg-red-400"}`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-blue-700 font-semibold">{tx.docNo}</span>
                      <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">{tx.source}</span>
                    </div>
                    <p className="text-xs text-gray-400 truncate">{tx.label} · {tx.date}</p>
                  </div>
                </div>
                <p className={`text-xs font-semibold tabular-nums shrink-0 ${tx.type === "in" ? "text-green-600" : "text-red-500"}`}>
                  {tx.type === "in" ? "+" : "−"}{fmtMYR(tx.amount)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {transactions.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-400">No paid transactions in {year}.</p>
          <p className="text-xs text-gray-300 mt-1">Mark invoices, POs, or PVs as Paid to see them here.</p>
        </div>
      )}
    </div>
  );
}
