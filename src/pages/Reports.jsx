import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, Printer } from "lucide-react";
import { getConfig } from "../utils/storage";
import { getRows, getToken } from "../utils/google";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtMYR(n) {
  return `MYR ${Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

function fmtDate(d) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${parseInt(day)} ${MONTHS[parseInt(m) - 1]} ${y}`;
}

function daysSince(dateStr) {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today - date) / 86_400_000);
}

const STATUS_PILL = {
  Paid:      "bg-green-100 text-green-700",
  Accepted:  "bg-green-100 text-green-700",
  Delivered: "bg-green-100 text-green-700",
  Received:  "bg-blue-100 text-blue-700",
  Overdue:   "bg-red-100 text-red-600",
  Pending:   "bg-yellow-100 text-yellow-700",
  Rejected:  "bg-gray-100 text-gray-500",
  Cancelled: "bg-gray-100 text-gray-400",
};

const TABS = [
  { id: "statement", label: "Statement" },
  { id: "aging",     label: "Aging" },
  { id: "pl",        label: "P&L" },
  { id: "sales",     label: "Sales" },
];

// ── Statement of Account ──────────────────────────────────────────────────────
function StatementTab({ data }) {
  const [client, setClient] = useState("");

  const clients = useMemo(() => {
    const set = new Set([
      ...data.invRows.map(r => r.Client),
      ...data.qtRows.map(r =>  r.Client),
      ...data.doRows.map(r =>  r.Client),
    ].filter(Boolean));
    return [...set].sort();
  }, [data]);

  const rows = useMemo(() => {
    if (!client) return [];
    return [
      ...data.qtRows.filter(r => r.Client === client).map(r => ({ ...r, _type: "Quotation",     _amount: parseFloat(r.Total) || 0 })),
      ...data.invRows.filter(r => r.Client === client).map(r => ({ ...r, _type: "Invoice",       _amount: parseFloat(r.Total) || 0 })),
      ...data.doRows.filter(r => r.Client === client).map(r => ({ ...r, _type: "Delivery Order", _amount: 0 })),
    ].sort((a, b) => new Date(a.Date) - new Date(b.Date));
  }, [client, data]);

  const invRows     = rows.filter(r => r._type === "Invoice");
  const totalBilled = invRows.reduce((s, r) => s + r._amount, 0);
  const totalPaid   = invRows.filter(r => r.Status === "Paid").reduce((s, r) => s + r._amount, 0);
  const balance     = totalBilled - totalPaid;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select
          value={client}
          onChange={e => setClient(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#57A9A9] min-w-52"
        >
          <option value="">Select client…</option>
          {clients.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {client && (
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            <Printer size={15} />
            Print
          </button>
        )}
      </div>

      {!client ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-400">Select a client to view their statement.</p>
        </div>
      ) : (
        <>
          {/* Print-only header */}
          <div className="hidden print:block mb-4">
            <p className="text-lg font-bold text-gray-800">Statement of Account</p>
            <p className="text-sm text-gray-700 mt-1 font-medium">{client}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Dzanex Technology · TR0320764-P · Generated {fmtDate(new Date().toISOString().slice(0, 10))}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-[11px] text-gray-400 mb-1">Total Invoiced</p>
              <p className="text-sm font-bold text-gray-800">{fmtMYR(totalBilled)}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{invRows.length} invoice{invRows.length !== 1 ? "s" : ""}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-[11px] text-gray-400 mb-1">Total Paid</p>
              <p className="text-sm font-bold text-green-600">{fmtMYR(totalPaid)}</p>
            </div>
            <div className={`rounded-xl border p-4 ${balance > 0 ? "bg-orange-50 border-orange-200" : "bg-white border-gray-200"}`}>
              <p className="text-[11px] text-gray-400 mb-1">Balance Due</p>
              <p className={`text-sm font-bold ${balance > 0 ? "text-orange-600" : "text-gray-400"}`}>{fmtMYR(balance)}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">{client} — All Documents</h2>
            </div>
            {rows.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No documents found for this client.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#1B3A5C] text-white">
                      <th className="text-left px-4 py-2.5 font-semibold">Date</th>
                      <th className="text-left px-4 py-2.5 font-semibold">Doc No</th>
                      <th className="text-left px-4 py-2.5 font-semibold">Type</th>
                      <th className="text-right px-4 py-2.5 font-semibold">Amount</th>
                      <th className="text-left px-4 py-2.5 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map((r, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2.5 text-gray-600">{fmtDate(r.Date)}</td>
                        <td className="px-4 py-2.5 font-mono text-blue-700 font-semibold">{r["Doc No"]}</td>
                        <td className="px-4 py-2.5 text-gray-600">{r._type}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-medium text-gray-700">
                          {r._amount > 0 ? fmtMYR(r._amount) : "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          {r.Status ? (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_PILL[r.Status] || "bg-gray-100 text-gray-500"}`}>
                              {r.Status}
                            </span>
                          ) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {balance > 0 && (
                    <tfoot>
                      <tr className="bg-orange-50 border-t-2 border-orange-200">
                        <td colSpan={3} className="px-4 py-2.5 text-xs font-semibold text-orange-700">Balance Due</td>
                        <td className="px-4 py-2.5 text-right text-xs font-bold text-orange-700 tabular-nums">{fmtMYR(balance)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Debtor Aging ──────────────────────────────────────────────────────────────
function AgingTab({ data }) {
  const unpaid = data.invRows.filter(r => r.Status === "Pending" || r.Status === "Overdue");

  const clientMap = {};
  unpaid.forEach(r => {
    const c = r.Client || "Unknown";
    if (!clientMap[c]) clientMap[c] = { b0: 0, b30: 0, b60: 0, b90: 0 };
    const days = daysSince(r.Date);
    const amt  = parseFloat(r.Total) || 0;
    if      (days <= 30) clientMap[c].b0  += amt;
    else if (days <= 60) clientMap[c].b30 += amt;
    else if (days <= 90) clientMap[c].b60 += amt;
    else                 clientMap[c].b90 += amt;
  });

  const clients = Object.entries(clientMap).sort((a, b) => {
    const tA = a[1].b0 + a[1].b30 + a[1].b60 + a[1].b90;
    const tB = b[1].b0 + b[1].b30 + b[1].b60 + b[1].b90;
    return tB - tA;
  });

  const totals = clients.reduce(
    (acc, [, m]) => ({ b0: acc.b0 + m.b0, b30: acc.b30 + m.b30, b60: acc.b60 + m.b60, b90: acc.b90 + m.b90 }),
    { b0: 0, b30: 0, b60: 0, b90: 0 }
  );
  const grand = totals.b0 + totals.b30 + totals.b60 + totals.b90;

  if (unpaid.length === 0) return (
    <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
      <p className="text-sm text-green-600 font-medium">All invoices are paid!</p>
      <p className="text-xs text-gray-400 mt-1">No outstanding debts.</p>
    </div>
  );

  const buckets = [
    { label: "0–30 days",  key: "b0",  color: "text-yellow-600" },
    { label: "31–60 days", key: "b30", color: "text-orange-500" },
    { label: "61–90 days", key: "b60", color: "text-red-500" },
    { label: "90+ days",   key: "b90", color: "text-red-700" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {buckets.map(({ label, key, color }) => (
          <div key={key} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-[11px] text-gray-400 mb-1">{label}</p>
            <p className={`text-sm font-bold ${totals[key] > 0 ? color : "text-gray-300"}`}>{fmtMYR(totals[key])}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Outstanding by Client</h2>
          <span className="text-xs text-gray-400">
            Total: <span className="font-semibold text-orange-600">{fmtMYR(grand)}</span>
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#1B3A5C] text-white">
                <th className="text-left px-4 py-2.5 font-semibold">Client</th>
                <th className="text-right px-4 py-2.5 font-semibold">0–30 days</th>
                <th className="text-right px-4 py-2.5 font-semibold">31–60 days</th>
                <th className="text-right px-4 py-2.5 font-semibold">61–90 days</th>
                <th className="text-right px-4 py-2.5 font-semibold">90+ days</th>
                <th className="text-right px-4 py-2.5 font-semibold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clients.map(([name, m]) => {
                const total = m.b0 + m.b30 + m.b60 + m.b90;
                return (
                  <tr key={name}>
                    <td className="px-4 py-2.5 text-gray-700 font-medium">{name}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-yellow-600">{m.b0  > 0 ? fmtMYR(m.b0)  : "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-orange-500">{m.b30 > 0 ? fmtMYR(m.b30) : "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-red-500">  {m.b60 > 0 ? fmtMYR(m.b60) : "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-red-700">  {m.b90 > 0 ? fmtMYR(m.b90) : "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-gray-800">{fmtMYR(total)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t-2 border-gray-200 font-bold">
                <td className="px-4 py-2.5 text-gray-700">Total</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-yellow-600">{fmtMYR(totals.b0)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-orange-500">{fmtMYR(totals.b30)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-red-500">{fmtMYR(totals.b60)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-red-700">{fmtMYR(totals.b90)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-gray-800">{fmtMYR(grand)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Profit & Loss ─────────────────────────────────────────────────────────────
function PLTab({ data }) {
  const [year, setYear] = useState(String(new Date().getFullYear()));

  const allYears = [...new Set([
    ...data.invRows.map(r => (r.Date || "").slice(0, 4)),
    ...data.poRows.map(r =>  (r.Date || "").slice(0, 4)),
    ...data.pvRows.map(r =>  (r.Date || "").slice(0, 4)),
  ].filter(y => y.length === 4))].sort((a, b) => b - a);

  const paidInv = data.invRows.filter(r => r.Status === "Paid" && (r.Date || "").startsWith(year));
  const paidPO  = data.poRows.filter(r =>  r.Status === "Paid" && (r.Date || "").startsWith(year));
  const paidPV  = data.pvRows.filter(r =>  r.Status === "Paid" && (r.Date || "").startsWith(year));

  const totalRevenue  = paidInv.reduce((s, r) => s + (parseFloat(r.Total)  || 0), 0);
  const totalExpenses = [
    ...paidPO.map(r => parseFloat(r.Total)  || 0),
    ...paidPV.map(r => parseFloat(r.Amount) || 0),
  ].reduce((s, n) => s + n, 0);
  const grossProfit = totalRevenue - totalExpenses;
  const margin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : "—";

  const monthMap = {};
  for (let m = 1; m <= 12; m++) {
    const ym = `${year}-${String(m).padStart(2, "0")}`;
    monthMap[ym] = { revenue: 0, expenses: 0 };
  }
  paidInv.forEach(r => { const ym = (r.Date || "").slice(0, 7); if (monthMap[ym]) monthMap[ym].revenue  += parseFloat(r.Total)  || 0; });
  paidPO.forEach(r =>  { const ym = (r.Date || "").slice(0, 7); if (monthMap[ym]) monthMap[ym].expenses += parseFloat(r.Total)  || 0; });
  paidPV.forEach(r =>  { const ym = (r.Date || "").slice(0, 7); if (monthMap[ym]) monthMap[ym].expenses += parseFloat(r.Amount) || 0; });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 print:hidden">
        <select
          value={year}
          onChange={e => setYear(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#57A9A9]"
        >
          {(allYears.length > 0 ? allYears : [String(new Date().getFullYear())]).map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <button onClick={() => window.print()} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <Printer size={15} />
        </button>
      </div>

      {/* Print-only header */}
      <div className="hidden print:block mb-4">
        <p className="text-lg font-bold text-gray-800">Profit & Loss Statement — {year}</p>
        <p className="text-xs text-gray-400">Dzanex Technology · TR0320764-P</p>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Revenue",      val: fmtMYR(totalRevenue),  color: "text-green-600" },
          { label: "Expenses",     val: fmtMYR(totalExpenses), color: "text-red-500" },
          { label: "Gross Profit", val: fmtMYR(grossProfit),   color: grossProfit >= 0 ? "text-[#57A9A9]" : "text-red-500" },
          { label: "Margin",       val: margin === "—" ? "—" : `${margin}%`, color: grossProfit >= 0 ? "text-[#57A9A9]" : "text-red-500" },
        ].map(({ label, val, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-[11px] text-gray-400 mb-1">{label}</p>
            <p className={`text-sm font-bold ${color}`}>{val}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Monthly P&L — {year}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#1B3A5C] text-white">
                <th className="text-left px-4 py-2.5 font-semibold">Month</th>
                <th className="text-right px-4 py-2.5 font-semibold">Revenue</th>
                <th className="text-right px-4 py-2.5 font-semibold">Expenses</th>
                <th className="text-right px-4 py-2.5 font-semibold">Gross Profit</th>
                <th className="text-right px-4 py-2.5 font-semibold">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {Object.entries(monthMap).map(([ym, m]) => {
                const profit  = m.revenue - m.expenses;
                const mg      = m.revenue > 0 ? ((profit / m.revenue) * 100).toFixed(1) : null;
                const hasData = m.revenue > 0 || m.expenses > 0;
                const [, mo]  = ym.split("-");
                return (
                  <tr key={ym} className={hasData ? "" : "opacity-30"}>
                    <td className="px-4 py-2.5 text-gray-700">{MONTHS[parseInt(mo) - 1]}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-green-600">{m.revenue  > 0 ? fmtMYR(m.revenue)  : "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-red-500">  {m.expenses > 0 ? fmtMYR(m.expenses) : "—"}</td>
                    <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${!hasData ? "text-gray-300" : profit >= 0 ? "text-[#57A9A9]" : "text-red-500"}`}>
                      {hasData ? fmtMYR(profit) : "—"}
                    </td>
                    <td className={`px-4 py-2.5 text-right tabular-nums ${!mg ? "text-gray-300" : parseFloat(mg) >= 0 ? "text-[#57A9A9]" : "text-red-500"}`}>
                      {mg !== null ? `${mg}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t-2 border-gray-200 font-bold">
                <td className="px-4 py-2.5 text-gray-700">Total {year}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-green-600">{fmtMYR(totalRevenue)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-red-500">{fmtMYR(totalExpenses)}</td>
                <td className={`px-4 py-2.5 text-right tabular-nums ${grossProfit >= 0 ? "text-[#57A9A9]" : "text-red-500"}`}>{fmtMYR(grossProfit)}</td>
                <td className={`px-4 py-2.5 text-right tabular-nums ${grossProfit >= 0 ? "text-[#57A9A9]" : "text-red-500"}`}>{margin === "—" ? "—" : `${margin}%`}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Sales by Client ───────────────────────────────────────────────────────────
function SalesTab({ data }) {
  const clientMap = {};
  data.invRows.forEach(r => {
    const c = r.Client || "Unknown";
    if (!clientMap[c]) clientMap[c] = { billed: 0, paid: 0, count: 0, lastDate: "" };
    const amt = parseFloat(r.Total) || 0;
    clientMap[c].billed += amt;
    if (r.Status === "Paid") clientMap[c].paid += amt;
    clientMap[c].count++;
    if (!clientMap[c].lastDate || r.Date > clientMap[c].lastDate) clientMap[c].lastDate = r.Date;
  });

  const clients     = Object.entries(clientMap).sort((a, b) => b[1].billed - a[1].billed);
  const totalBilled = clients.reduce((s, [, m]) => s + m.billed, 0);
  const totalPaid   = clients.reduce((s, [, m]) => s + m.paid, 0);

  if (clients.length === 0) return (
    <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
      <p className="text-sm text-gray-400">No invoice data yet.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-[11px] text-gray-400 mb-1">Total Billed</p>
          <p className="text-sm font-bold text-gray-800">{fmtMYR(totalBilled)}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{clients.length} client{clients.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-[11px] text-gray-400 mb-1">Total Collected</p>
          <p className="text-sm font-bold text-green-600">{fmtMYR(totalPaid)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-[11px] text-gray-400 mb-1">Outstanding</p>
          <p className={`text-sm font-bold ${totalBilled - totalPaid > 0 ? "text-orange-500" : "text-gray-400"}`}>
            {fmtMYR(totalBilled - totalPaid)}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Sales by Client — All Time</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#1B3A5C] text-white">
                <th className="text-left px-4 py-2.5 font-semibold">Client</th>
                <th className="text-right px-4 py-2.5 font-semibold">Jobs</th>
                <th className="text-right px-4 py-2.5 font-semibold">Total Billed</th>
                <th className="text-right px-4 py-2.5 font-semibold">Collected</th>
                <th className="text-right px-4 py-2.5 font-semibold">Outstanding</th>
                <th className="text-right px-4 py-2.5 font-semibold">Last Invoice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clients.map(([name, m]) => {
                const outstanding = m.billed - m.paid;
                return (
                  <tr key={name}>
                    <td className="px-4 py-2.5 text-gray-700 font-medium">{name}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-500">{m.count}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-gray-800">{fmtMYR(m.billed)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-green-600">{fmtMYR(m.paid)}</td>
                    <td className={`px-4 py-2.5 text-right tabular-nums ${outstanding > 0 ? "text-orange-500 font-medium" : "text-gray-300"}`}>
                      {outstanding > 0 ? fmtMYR(outstanding) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-400">{fmtDate(m.lastDate)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Main Reports page ─────────────────────────────────────────────────────────
export default function Reports() {
  const [activeTab, setActiveTab] = useState("statement");
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    const { sheetId } = getConfig();
    const token = getToken();
    if (!sheetId || !token) { setLoading(false); return; }
    try {
      const [invRows, qtRows, poRows, doRows, pvRows] = await Promise.all([
        getRows(sheetId, "Invoice",   token),
        getRows(sheetId, "Quotation", token),
        getRows(sheetId, "PO",        token),
        getRows(sheetId, "DO",        token),
        getRows(sheetId, "PV",        token),
      ]);
      setData({ invRows, qtRows, poRows, doRows, pvRows });
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Reports</h1>
          <p className="text-xs text-gray-400 mt-0.5">Business analytics & statements</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 print:hidden">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 text-xs font-medium py-2 px-2 rounded-lg transition-all ${
              activeTab === t.id
                ? "bg-white text-[#1B3A5C] shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "statement" && <StatementTab data={data} />}
      {activeTab === "aging"     && <AgingTab     data={data} />}
      {activeTab === "pl"        && <PLTab        data={data} />}
      {activeTab === "sales"     && <SalesTab     data={data} />}
    </div>
  );
}
