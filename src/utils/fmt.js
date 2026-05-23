// Formats n to "1,234.56" (2 dp, thousands commas)
export function fmt2(n) {
  return Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Formats n to "MYR 1,234.56"
export function fmtMYR(n) {
  return `MYR ${fmt2(n)}`;
}
