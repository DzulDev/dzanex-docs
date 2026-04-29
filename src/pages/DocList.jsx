import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getConfig } from "../utils/storage";
import { getRows, updateCell, getToken } from "../utils/google";
import { ChevronDown, ExternalLink, FileText, Loader2, RefreshCw } from "lucide-react";

const STATUS_OPTIONS = {
  Quotation: ["Pending", "Accepted", "Rejected"],
  Invoice:   ["Pending", "Paid", "Overdue"],
  PO:        ["Pending", "Received", "Cancelled"],
  DO:        ["Pending", "Delivered", "Cancelled"],
};

const STATUS_COL = {
  Quotation: "H",
  Invoice:   "H",
  PO:        "H",
  DO:        "F",
};

const CONVERT_OPTIONS = {
  Quotation: [
    { label: "Invoice",        path: "/invoice" },
    { label: "Delivery Order", path: "/do" },
  ],
  Invoice: [
    { label: "Delivery Order", path: "/do" },
  ],
};

const STATUS_STYLE = {
  Pending:   "bg-yellow-50 text-yellow-700 border-yellow-200",
  Accepted:  "bg-green-50  text-green-700  border-green-200",
  Paid:      "bg-green-50  text-green-700  border-green-200",
  Received:  "bg-blue-50   text-blue-700   border-blue-200",
  Delivered: "bg-blue-50   text-blue-700   border-blue-200",
  Rejected:  "bg-red-50    text-red-600    border-red-200",
  Overdue:   "bg-orange-50 text-orange-600 border-orange-200",
  Cancelled: "bg-gray-50   text-gray-500   border-gray-200",
};

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

function getPrefill(row) {
  if (row["_raw"]) {
    try { return JSON.parse(row["_raw"]); } catch { /* ignore */ }
  }
  try { return JSON.parse(localStorage.getItem(`dzanex_doc_${row["Doc No"]}`) || "null"); }
  catch { return null; }
}

export default function DocList({ sheetName, title }) {
  const [rows, setRows]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [updating, setUpdating] = useState(null);

  // Which row's dropdown is open + its screen coordinates
  const [openStatus,  setOpenStatus]  = useState(null);
  const [statusPos,   setStatusPos]   = useState(null); // { top, left }
  const [openConvert, setOpenConvert] = useState(null);
  const [convertPos,  setConvertPos]  = useState(null); // { top, left }

  const navigate = useNavigate();
  const convertOptions = CONVERT_OPTIONS[sheetName] || [];

  function closeAll() {
    setOpenStatus(null);
    setOpenConvert(null);
  }

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
    closeAll();
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
    closeAll();
    navigate(path, { state: { prefill } });
  }

  function toggleStatus(e, row) {
    if (openStatus === row._rowNum) { closeAll(); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    setOpenConvert(null);
    setStatusPos({ top: rect.bottom + 4, left: rect.left });
    setOpenStatus(row._rowNum);
  }

  function toggleConvert(e, row) {
    if (openConvert === row._rowNum) { closeAll(); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    setOpenStatus(null);
    // align dropdown right-edge to button right-edge
    setConvertPos({ top: rect.bottom + 4, left: Math.max(4, rect.right - 180) });
    setOpenConvert(row._rowNum);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading…</div>
  );

  const headers = rows[0]
    ? Object.keys(rows[0]).filter(h => h !== "Drive Link" && !h.startsWith("_"))
    : [];

  const activeStatusRow  = rows.find(r => r._rowNum === openStatus);
  const activeConvertRow = rows.find(r => r._rowNum === openConvert);

  return (
    <div>
      {/* Backdrop — closes any open dropdown when clicking elsewhere */}
      {(openStatus !== null || openConvert !== null) && (
        <div className="fixed inset-0 z-40" onClick={closeAll} />
      )}

      {/* Status dropdown — rendered fixed outside the table overflow context */}
      {openStatus !== null && statusPos && activeStatusRow && (
        <div
          style={{ position: "fixed", top: statusPos.top, left: statusPos.left, zIndex: 50 }}
          className="bg-white border border-gray-200 rounded-xl shadow-xl py-1 min-w-36"
        >
          {(STATUS_OPTIONS[sheetName] || ["Pending"]).map(s => (
            <button
              key={s}
              onClick={() => handleStatusChange(activeStatusRow, s)}
              className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2.5 transition-colors
                ${s === (activeStatusRow.Status || "Pending")
                  ? "bg-gray-50 font-semibold text-gray-800"
                  : "text-gray-600 hover:bg-gray-50"}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[s] || "bg-gray-300"}`} />
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Convert dropdown — rendered fixed outside the table overflow context */}
      {openConvert !== null && convertPos && activeConvertRow && (
        <div
          style={{ position: "fixed", top: convertPos.top, left: convertPos.left, zIndex: 50 }}
          className="bg-white border border-gray-200 rounded-xl shadow-xl py-1 w-44"
        >
          <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Convert to</p>
          {convertOptions.map(opt => (
            <button
              key={opt.path}
              onClick={() => handleConvert(activeConvertRow, opt.path)}
              className="w-full text-left px-3 py-2.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors"
            >
              <FileText size={13} className="text-[#57A9A9] shrink-0" />
              {opt.label}
            </button>
          ))}
        </div>
      )}

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
                          <button
                            disabled={updating === row._rowNum}
                            onClick={e => toggleStatus(e, row)}
                            className={`inline-flex items-center gap-1.5 text-xs font-medium pl-2 pr-2 py-1 rounded-full border transition-all whitespace-nowrap
                              ${STATUS_STYLE[row[h]] || "bg-gray-50 text-gray-500 border-gray-200"}
                              ${updating === row._rowNum ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:shadow-sm"}`}
                          >
                            {updating === row._rowNum
                              ? <Loader2 size={9} className="animate-spin" />
                              : <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[row[h]] || "bg-gray-300"}`} />
                            }
                            {row[h] || "Pending"}
                            <ChevronDown size={10} className={`transition-transform ${openStatus === row._rowNum ? "rotate-180" : ""}`} />
                          </button>
                        ) : (
                          row[h]
                        )}
                      </td>
                    ))}

                    {/* PDF link */}
                    <td className="px-4 py-3">
                      {row["Drive Link"] ? (
                        <a href={row["Drive Link"]} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors">
                          <ExternalLink size={12} />
                          Open
                        </a>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>

                    {/* Convert */}
                    {convertOptions.length > 0 && (
                      <td className="px-4 py-3">
                        <button
                          onClick={e => toggleConvert(e, row)}
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[#57A9A9]/10 text-[#57A9A9] hover:bg-[#57A9A9]/20 border border-[#57A9A9]/30 transition-colors whitespace-nowrap"
                        >
                          Convert
                          <ChevronDown size={10} className={`transition-transform ${openConvert === row._rowNum ? "rotate-180" : ""}`} />
                        </button>
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
