import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getConfig } from "../utils/storage";
import { getRows, updateCell, getToken } from "../utils/google";
import { ExternalLink, RefreshCw, ArrowRight } from "lucide-react";

const STATUS_OPTIONS = {
  Quotation: ["Pending", "Accepted", "Rejected"],
  Invoice:   ["Pending", "Paid", "Overdue"],
  PO:        ["Pending", "Received", "Cancelled"],
  DO:        ["Pending", "Delivered", "Cancelled"],
};

// Column letter of "Status" for each sheet
const STATUS_COL = {
  Quotation: "H",
  Invoice:   "H",
  PO:        "H",
  DO:        "F",
};

const CONVERT_OPTIONS = {
  Quotation: [
    { label: "Invoice", path: "/invoice" },
    { label: "Delivery Order", path: "/do" },
  ],
  Invoice: [
    { label: "Delivery Order", path: "/do" },
  ],
};

function getPrefill(row) {
  // Primary: _raw column from Google Sheets (works on any device)
  if (row["_raw"]) {
    try { return JSON.parse(row["_raw"]); } catch { /* ignore */ }
  }
  // Fallback: localStorage (same device only, for older docs)
  try { return JSON.parse(localStorage.getItem(`dzanex_doc_${row["Doc No"]}`) || "null"); }
  catch { return null; }
}

const STATUS_STYLE = {
  Pending:   "bg-yellow-100 text-yellow-700",
  Accepted:  "bg-green-100 text-green-700",
  Paid:      "bg-green-100 text-green-700",
  Received:  "bg-blue-100 text-blue-700",
  Delivered: "bg-blue-100 text-blue-700",
  Rejected:  "bg-red-100 text-red-600",
  Overdue:   "bg-orange-100 text-orange-600",
  Cancelled: "bg-gray-100 text-gray-500",
};

export default function DocList({ sheetName, title }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [openConvert, setOpenConvert] = useState(null);
  const navigate = useNavigate();
  const convertOptions = CONVERT_OPTIONS[sheetName] || []; // rowNum being updated

  async function load() {
    setLoading(true);
    try {
      const { sheetId } = getConfig();
      const token = getToken();
      if (!sheetId || !token) return;
      const data = await getRows(sheetId, sheetName, token);
      setRows(data.reverse());
    } catch (e) {
      console.error(e);
      if (e.httpStatus === 401) navigate("/login");
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [sheetName]);

  async function handleStatusChange(row, newStatus) {
    const { sheetId } = getConfig();
    const token = getToken();
    const col = STATUS_COL[sheetName];
    if (!col || !sheetId || !token) return;
    setUpdating(row._rowNum);
    try {
      await updateCell(sheetId, sheetName, row._rowNum, col, newStatus, token);
      setRows(prev => prev.map(r => r._rowNum === row._rowNum ? { ...r, Status: newStatus } : r));
    } catch (e) {
      console.error(e);
    } finally {
      setUpdating(null);
    }
  }

  function handleConvert(row, path) {
    const prefill = getPrefill(row);
    setOpenConvert(null);
    navigate(path, { state: { prefill } });
  }

  if (loading) return (
    <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading…</div>
  );

  const headers = rows[0]
    ? Object.keys(rows[0]).filter(h => h !== "Drive Link" && !h.startsWith("_"))
    : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h2 className="font-semibold text-gray-700">All {title}s ({rows.length})</h2>
        <button onClick={load} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 shrink-0">
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-12 text-center text-gray-400 text-sm">
          No records yet.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <tr>
                  {headers.map(h => (
                    <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                  ))}
                  <th className="px-4 py-3 text-left">PDF</th>
                  {convertOptions.length > 0 && <th className="px-4 py-3 text-left">Convert</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    {headers.map(h => (
                      <td key={h} className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {h === "Doc No" ? (
                          <span className="font-mono text-blue-700">{row[h]}</span>
                        ) : h === "Status" ? (
                          <select
                            value={row[h] || "Pending"}
                            disabled={updating === row._rowNum}
                            onChange={e => handleStatusChange(row, e.target.value)}
                            className={`text-xs font-medium px-2 py-0.5 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 transition-opacity ${STATUS_STYLE[row[h]] || "bg-gray-100 text-gray-500"} ${updating === row._rowNum ? "opacity-50" : ""}`}
                          >
                            {(STATUS_OPTIONS[sheetName] || ["Pending"]).map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        ) : (
                          row[h]
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      {row["Drive Link"] && (
                        <a href={row["Drive Link"]} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 text-blue-500 hover:text-blue-700 text-xs">
                          <ExternalLink size={12} />
                          Open
                        </a>
                      )}
                    </td>
                    {convertOptions.length > 0 && (
                      <td className="px-4 py-3 relative">
                        <button
                          onClick={() => setOpenConvert(openConvert === row._rowNum ? null : row._rowNum)}
                          className="flex items-center gap-1 text-xs font-medium text-[#57A9A9] hover:text-[#1B3A5C] transition-colors"
                        >
                          <ArrowRight size={13} />
                          Convert
                        </button>
                        {openConvert === row._rowNum && (
                          <div className="absolute left-0 top-8 z-10 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-36">
                            {convertOptions.map(opt => (
                              <button
                                key={opt.path}
                                onClick={() => handleConvert(row, opt.path)}
                                className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                              >
                                <ArrowRight size={11} className="text-[#57A9A9]" />
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
