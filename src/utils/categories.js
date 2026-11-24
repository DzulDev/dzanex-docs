// Expense categories for Payment Vouchers. Edit this list to rename/add categories.
export const EXPENSE_CATEGORIES = [
  "Materials & Components",
  "Tools & Equipment",
  "Travel & Mileage",
  "Staff & Events",
  "Software & Subscriptions",
  "Office & Admin",
  "Marketing",
  "Other",
];

export const UNCATEGORISED = "Uncategorised";
export const PO_CATEGORY   = "Supplier Purchase Orders";

// Category of a PV sheet row, stored in its _raw JSON (older PVs have none)
export function pvCategory(row) {
  try { return JSON.parse(row?._raw || "{}").category || UNCATEGORISED; }
  catch { return UNCATEGORISED; }
}
