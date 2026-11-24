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
