import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, Receipt, ShoppingCart, Truck, TrendingUp, Plus } from "lucide-react";
import { getConfig } from "../utils/storage";
import { getRows, getToken } from "../utils/google";
import { format } from "date-fns";

const CARDS = [
  { type: "Quotation", label: "Quotations", icon: FileText, color: "teal", to: "/quotation" },
  { type: "Invoice", label: "Invoices", icon: Receipt, color: "teal", to: "/invoice" },
  { type: "PO", label: "Purchase Orders", icon: ShoppingCart, color: "coral", to: "/po" },
  { type: "DO", label: "Delivery Orders", icon: Truck, color: "coral", to: "/do" },
];

const COLOR = {
  teal:  "bg-[#EBF6F6] text-[#3A8A8A] border-[#57A9A9]/30",
  coral: "bg-[#FDF1EE] text-[#C2614A] border-[#E8917A]/30",
};

const ICON_BG = {
  teal:  "bg-[#57A9A9]/20 text-[#3A8A8A]",
  coral: "bg-[#E8917A]/20 text-[#C2614A]",
};

export default function Dashboard() {
  const [stats, setStats] = useState({});
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    async function load() {
      const { sheetId } = getConfig();
      const token = getToken();
      if (!sheetId || !token) return;
      try {
        const [qt, inv, po, doRows] = await Promise.all([
          getRows(sheetId, "Quotation", token),
          getRows(sheetId, "Invoice", token),
          getRows(sheetId, "PO", token),
          getRows(sheetId, "DO", token),
        ]);
        setStats({
          Quotation: qt.length,
          Invoice: inv.length,
          PO: po.length,
          DO: doRows.length,
        });
        const all = [
          ...qt.map((r) => ({ ...r, _type: "Quotation" })),
          ...inv.map((r) => ({ ...r, _type: "Invoice" })),
          ...po.map((r) => ({ ...r, _type: "PO" })),
          ...doRows.map((r) => ({ ...r, _type: "DO" })),
        ]
          .sort((a, b) => new Date(b.Date) - new Date(a.Date))
          .slice(0, 8);
        setRecent(all);
      } catch {}
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Welcome back — Dzanex Technology</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {CARDS.map(({ type, label, icon: Icon, color, to }) => (
          <Link key={type} to={to} className={`bg-white border rounded-xl p-5 hover:shadow-md transition-shadow ${COLOR[color]}`}>
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${ICON_BG[color]}`}>
                <Icon size={20} />
              </div>
              <Plus size={16} className="opacity-50" />
            </div>
            <p className="text-2xl font-bold">{stats[type] ?? "—"}</p>
            <p className="text-sm font-medium opacity-80">{label}</p>
          </Link>
        ))}
      </div>

      {/* Recent */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <TrendingUp size={16} className="text-gray-400" />
          <h2 className="font-semibold text-gray-700">Recent Documents</h2>
        </div>
        {recent.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-400 text-sm">
            No documents yet. Create your first one!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-5 py-3 text-left whitespace-nowrap">Doc No</th>
                  <th className="px-5 py-3 text-left whitespace-nowrap">Type</th>
                  <th className="px-5 py-3 text-left whitespace-nowrap">Client / Supplier</th>
                  <th className="px-5 py-3 text-left whitespace-nowrap">Date</th>
                  <th className="px-5 py-3 text-right whitespace-nowrap">Total</th>
                  <th className="px-5 py-3 text-left whitespace-nowrap">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recent.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-mono text-blue-700 whitespace-nowrap">{r["Doc No"]}</td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        {r._type}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-700 whitespace-nowrap">{r.Client || r.Supplier}</td>
                    <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{r.Date}</td>
                    <td className="px-5 py-3 text-right font-medium text-gray-800 whitespace-nowrap">
                      {r.Total ? `MYR ${Number(r.Total).toFixed(2)}` : "—"}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      {r["Drive Link"] && (
                        <a href={r["Drive Link"]} target="_blank" rel="noreferrer"
                          className="text-blue-500 hover:underline text-xs">View PDF</a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
