// Shared invoice money helpers (discount → SST → deposit)

// Totals from the saved invoice form data (_raw JSON)
export function invoiceTotals(data) {
  const gross       = (data?.items || []).reduce((s, i) => s + (parseFloat(i.qty) || 0) * (parseFloat(i.unitPrice) || 0), 0);
  const discountAmt = gross * (Number(data?.discount) || 0) / 100;
  const afterDisc   = gross - discountAmt;
  const tax         = afterDisc * (Number(data?.taxRate) || 0) / 100;
  const total       = afterDisc + tax;
  const deposit     = Number(data?.depositPaid) || 0;
  return { gross, discountAmt, tax, total, deposit, balance: Math.max(0, total - deposit) };
}

// Deposit already received, read from a sheet row's _raw JSON
export function rowDeposit(row) {
  try { return Number(JSON.parse(row?._raw || "{}").depositPaid) || 0; }
  catch { return 0; }
}

// What the client still owes on an unpaid sheet row (Total minus any deposit)
export function rowBalance(row) {
  const total = parseFloat(row?.Total) || 0;
  return Math.max(0, total - rowDeposit(row));
}

// Money actually received on an invoice row, as dated events (cash basis).
// - Deposit counts on its deposit date, balance on the date it was marked Paid.
// - Invoices with no deposit keep the old behaviour: full total on the invoice date once Paid.
export function incomeEvents(row) {
  const total = parseFloat(row?.Total) || 0;
  let raw = {};
  try { raw = JSON.parse(row?._raw || "{}"); } catch { /* ignore */ }
  const dep  = Math.min(Number(raw.depositPaid) || 0, total);
  const paid = row?.Status === "Paid";
  const out  = [];
  if (dep > 0) {
    out.push({ date: raw.depositDate || row.Date || "", amount: dep, kind: "Deposit", row });
    if (paid && total - dep > 0) out.push({ date: raw.paidDate || row.Date || "", amount: total - dep, kind: "Balance", row });
  } else if (paid) {
    out.push({ date: row.Date || "", amount: total, kind: "Full", row });
  }
  return out;
}

export function allIncomeEvents(rows) {
  return (rows || []).flatMap(incomeEvents);
}

// Sum of income received in a period (prefix like "2026" or "2026-11")
export function sumIncome(rows, prefix) {
  return allIncomeEvents(rows).filter(e => e.date.startsWith(prefix)).reduce((s, e) => s + e.amount, 0);
}
