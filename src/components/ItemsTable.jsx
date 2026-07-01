import { Plus, Trash2 } from "lucide-react";
import { fmt2 } from "../utils/fmt";

export default function ItemsTable({ items, onChange, showPrice = true }) {
  function add() {
    onChange([...items, { description: "", qty: 1, unit: "unit", costPrice: 0, markupPercent: 0, unitPrice: 0, notes: "", isBold: false }]);
  }

  function remove(i) {
    onChange(items.filter((_, idx) => idx !== i));
  }

  function update(i, field, value) {
    onChange(items.map((item, idx) => {
      if (idx !== i) return item;
      const next = { ...item, [field]: value };
      if (field === "costPrice" || field === "markupPercent") {
        const cost   = Number(field === "costPrice" ? value : (next.costPrice ?? item.unitPrice ?? 0)) || 0;
        const markup = Number(field === "markupPercent" ? value : next.markupPercent) || 0;
        next.unitPrice = cost * (1 + markup / 100);
      }
      return next;
    }));
  }

  const subtotal = items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unitPrice) || 0), 0);

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-blue-900 text-white">
            <tr>
              <th className="px-3 py-2 text-left w-8">#</th>
              <th className="px-3 py-2 text-left">Description</th>
              <th className="px-3 py-2 text-center w-20">Qty</th>
              <th className="px-3 py-2 text-center w-24">Unit</th>
              {showPrice && <th className="px-3 py-2 text-right w-24">Cost Price</th>}
              {showPrice && <th className="px-3 py-2 text-right w-20">Markup %</th>}
              {showPrice && <th className="px-3 py-2 text-right w-28">Sell Price</th>}
              {showPrice && <th className="px-3 py-2 text-right w-28">Amount</th>}
              {!showPrice && <th className="px-3 py-2 text-left">Notes</th>}
              <th className="px-3 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                <td className="px-3 py-2">
                  <input
                    className="w-full border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1"
                    value={item.description}
                    onChange={(e) => update(i, "description", e.target.value)}
                    placeholder="Item description"
                  />
                  {showPrice && (
                    <textarea
                      rows={2}
                      className="w-full border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 text-xs text-gray-400 resize-none mt-1 leading-tight"
                      value={item.notes || ""}
                      onChange={(e) => update(i, "notes", e.target.value)}
                      placeholder="• Details (one per line)…"
                    />
                  )}
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    className="w-full border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 text-center"
                    value={item.qty}
                    min={0}
                    onChange={(e) => update(i, "qty", e.target.value)}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    className="w-full border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 text-center"
                    value={item.unit}
                    onChange={(e) => update(i, "unit", e.target.value)}
                    placeholder="unit"
                  />
                </td>
                {showPrice && (
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      className="w-full border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 text-right"
                      value={item.costPrice ?? item.unitPrice ?? 0}
                      min={0}
                      step="0.01"
                      onChange={(e) => update(i, "costPrice", e.target.value)}
                    />
                  </td>
                )}
                {showPrice && (
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      className="w-full border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 text-right"
                      value={item.markupPercent ?? 0}
                      min={0}
                      step="0.1"
                      onChange={(e) => update(i, "markupPercent", e.target.value)}
                    />
                  </td>
                )}
                {showPrice && (
                  <td className="px-3 py-2 text-right text-gray-700 font-medium" title="Price shown to customer">
                    {fmt2(Number(item.unitPrice || 0))}
                  </td>
                )}
                {showPrice && (
                  <td className="px-3 py-2 text-right text-gray-700 font-medium">
                    {fmt2(Number(item.qty || 0) * Number(item.unitPrice || 0))}
                  </td>
                )}
                {!showPrice && (
                  <td className="px-3 py-2">
                    <input
                      className="w-full border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1"
                      value={item.notes || ""}
                      onChange={(e) => update(i, "notes", e.target.value)}
                      placeholder="Notes"
                    />
                  </td>
                )}
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    {showPrice && (
                      <button
                        type="button"
                        title="Toggle bold"
                        onClick={() => update(i, "isBold", !item.isBold)}
                        className={`w-5 h-5 text-xs font-black rounded flex items-center justify-center transition-colors ${item.isBold ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-400 hover:bg-gray-200"}`}
                      >
                        B
                      </button>
                    )}
                    <button
                      onClick={() => remove(i)}
                      className="text-red-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={showPrice ? 9 : 6} className="px-4 py-6 text-center text-gray-400 text-sm">
                  No items yet. Click "Add Item" to start.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-3">
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          <Plus size={15} />
          Add Item
        </button>
        {showPrice && (
          <div className="text-right text-sm">
            <span className="text-gray-500 mr-3">Subtotal:</span>
            <span className="font-semibold text-gray-800">MYR {fmt2(subtotal)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
