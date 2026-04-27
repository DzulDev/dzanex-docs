import { useEffect, useState } from "react";
import { getConfig } from "../utils/storage";
import { getRows, getToken } from "../utils/google";
import { ExternalLink, RefreshCw } from "lucide-react";

export default function DocList({ sheetName, title }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

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
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [sheetName]);

  if (loading) return (
    <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading…</div>
  );

  const headers = rows[0] ? Object.keys(rows[0]).filter((h) => h !== "Drive Link") : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-700">All {title}s ({rows.length})</h2>
        <button onClick={load} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
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
                  {headers.map((h) => (
                    <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                  ))}
                  <th className="px-4 py-3 text-left">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    {headers.map((h) => (
                      <td key={h} className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {h === "Doc No"
                          ? <span className="font-mono text-blue-700">{row[h]}</span>
                          : h === "Status"
                          ? <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">{row[h]}</span>
                          : row[h]}
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
